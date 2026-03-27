// Package bridge implements a JSON-RPC 2.0 client that communicates with
// the ai-spec-bridge process over stdio. It spawns the bridge as a subprocess,
// sends requests via stdin, and reads responses/notifications from stdout.
package bridge

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"
	"sync/atomic"
)

// Request is a JSON-RPC 2.0 request sent to the bridge.
type Request struct {
	JSONRPC string         `json:"jsonrpc"`
	ID      int64          `json:"id"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params,omitempty"`
}

// Response is a JSON-RPC 2.0 response received from the bridge.
type Response struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int64  `json:"id"`
	Result  any    `json:"result,omitempty"`
	Error   *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Data    any    `json:"data,omitempty"`
	} `json:"error,omitempty"`
}

// Notification is a JSON-RPC 2.0 notification (server-initiated, no ID).
type Notification struct {
	JSONRPC string         `json:"jsonrpc"`
	Method  string         `json:"method"`
	Params  map[string]any `json:"params"`
}

// NotificationHandler is a callback invoked when a notification is received.
type NotificationHandler func(n Notification)

// Client manages the bridge subprocess and JSON-RPC communication.
type Client struct {
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	done    chan struct{}
	nextID  atomic.Int64
	pending map[int64]chan Response
	mu      sync.Mutex

	// notificationHandlers maps method names to handler callbacks.
	notificationHandlers map[string]NotificationHandler
	handlersMu           sync.RWMutex
}

// New spawns the ai-spec-bridge subprocess and starts reading its output.
// bridgePath is the path to the bridge binary (e.g. "node dist/src/cli.js").
func New(bridgePath string) (*Client, error) {
	cmd := exec.Command("node", bridgePath)
	cmd.Stderr = os.Stderr

	stdin, err := cmd.StdinPipe()
	if err != nil {
		return nil, fmt.Errorf("bridge stdin pipe: %w", err)
	}

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return nil, fmt.Errorf("bridge stdout pipe: %w", err)
	}

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("bridge start: %w", err)
	}

	c := &Client{
		cmd:                  cmd,
		stdin:               stdin,
		done:                make(chan struct{}),
		pending:             make(map[int64]chan Response),
		notificationHandlers: make(map[string]NotificationHandler),
	}

	// Background goroutine reads stdout line-by-line and dispatches
	// responses and notifications.
	go c.readLoop(stdout)

	return c, nil
}

// Call sends a JSON-RPC request and waits for the response.
func (c *Client) Call(method string, params map[string]any) (any, error) {
	id := c.nextID.Add(1)

	req := Request{
		JSONRPC: "2.0",
		ID:      id,
		Method:  method,
		Params:  params,
	}

	respCh := make(chan Response, 1)
	c.mu.Lock()
	c.pending[id] = respCh
	c.mu.Unlock()

	data, err := json.Marshal(req)
	if err != nil {
		c.removePending(id)
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	if _, err := fmt.Fprintln(c.stdin, string(data)); err != nil {
		c.removePending(id)
		return nil, fmt.Errorf("write to bridge: %w", err)
	}

	resp := <-respCh
	if resp.Error != nil {
		return nil, fmt.Errorf("bridge error [%d]: %s", resp.Error.Code, resp.Error.Message)
	}
	return resp.Result, nil
}

// OnNotification registers a handler for a specific notification method.
// Multiple handlers for the same method are not supported; the last one wins.
func (c *Client) OnNotification(method string, handler NotificationHandler) {
	c.handlersMu.Lock()
	defer c.handlersMu.Unlock()
	c.notificationHandlers[method] = handler
}

// Close terminates the bridge subprocess and cleans up resources.
func (c *Client) Close() error {
	close(c.done)
	_ = c.stdin.Close()

	err := c.cmd.Wait()

	// Unblock any pending callers.
	c.mu.Lock()
	for id, ch := range c.pending {
		close(ch)
		delete(c.pending, id)
	}
	c.mu.Unlock()

	return err
}

func (c *Client) removePending(id int64) {
	c.mu.Lock()
	delete(c.pending, id)
	c.mu.Unlock()
}

// readLoop reads JSON-RPC messages from the bridge stdout line-by-line.
// Messages with an ID field are responses; messages without are notifications.
func (c *Client) readLoop(r io.Reader) {
	scanner := bufio.NewScanner(r)
	// Increase buffer size for large responses (e.g. session events with big payloads).
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)

	for scanner.Scan() {
		select {
		case <-c.done:
			return
		default:
		}

		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		// Try to parse as a response (has "id" field).
		var raw map[string]json.RawMessage
		if err := json.Unmarshal(line, &raw); err != nil {
			continue
		}

		if _, hasID := raw["id"]; hasID {
			var resp Response
			if err := json.Unmarshal(line, &resp); err != nil {
				continue
			}
			c.mu.Lock()
			if ch, ok := c.pending[resp.ID]; ok {
				delete(c.pending, resp.ID)
				ch <- resp
			}
			c.mu.Unlock()
		} else {
			// No ID means this is a server-initiated notification.
			var notif Notification
			if err := json.Unmarshal(line, &notif); err != nil {
				continue
			}
			c.handlersMu.RLock()
			handler := c.notificationHandlers[notif.Method]
			c.handlersMu.RUnlock()
			if handler != nil {
				handler(notif)
			}
		}
	}

	_ = scanner.Err()
}
