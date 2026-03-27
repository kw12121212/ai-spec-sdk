package bridge

import "sync"

// CallRecord records a single Call invocation for test assertions.
type CallRecord struct {
	Method string
	Params map[string]any
}

// MockCaller is a test double that implements Caller.
// Set CallFn to control responses; inspect CallHistory for assertions.
type MockCaller struct {
	// CallFn is invoked on each Call. Return (result, nil) for success or (nil, error) for failure.
	CallFn func(method string, params map[string]any) (any, error)

	mu            sync.Mutex
	callHistory   []CallRecord
	notifyHandler map[string]NotificationHandler
}

// NewMockCaller creates a MockCaller with default no-op behavior.
func NewMockCaller() *MockCaller {
	return &MockCaller{
		notifyHandler: make(map[string]NotificationHandler),
	}
}

// Call records the invocation and delegates to CallFn.
func (m *MockCaller) Call(method string, params map[string]any) (any, error) {
	m.mu.Lock()
	m.callHistory = append(m.callHistory, CallRecord{Method: method, Params: params})
	m.mu.Unlock()

	if m.CallFn != nil {
		return m.CallFn(method, params)
	}
	return nil, nil
}

// OnNotification stores the handler for later retrieval in tests.
func (m *MockCaller) OnNotification(method string, handler NotificationHandler) {
	m.mu.Lock()
	m.notifyHandler[method] = handler
	m.mu.Unlock()
}

// GetNotificationHandler returns the handler registered for a given method.
func (m *MockCaller) GetNotificationHandler(method string) NotificationHandler {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.notifyHandler[method]
}

// CallHistory returns a copy of all recorded calls.
func (m *MockCaller) CallHistory() []CallRecord {
	m.mu.Lock()
	defer m.mu.Unlock()
	out := make([]CallRecord, len(m.callHistory))
	copy(out, m.callHistory)
	return out
}

// CallCount returns the number of recorded calls.
func (m *MockCaller) CallCount() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.callHistory)
}
