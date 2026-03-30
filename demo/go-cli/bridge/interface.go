package bridge

// Caller is the interface for communicating with the bridge.
// Both the real Client and mock implementations satisfy this interface.
type Caller interface {
	Call(method string, params map[string]any) (any, error)
	OnNotification(method string, handler NotificationHandler)
}
