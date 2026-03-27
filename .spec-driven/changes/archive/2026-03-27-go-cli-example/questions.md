# Questions: go-cli-example

## Open

<!-- No open questions -->

## Resolved

- [x] Q: Should the Go CLI support the tool approval flow?
  Context: Tool approval is a key SDK feature; the example should demonstrate it.
  A: Yes, support it. Use `permissionMode: "approve"` as the default mode.

- [x] Q: What is the scope of the example?
  Context: Determines how many bridge methods and commands to implement.
  A: Full version — cover all bridge methods including workflow.run.

- [x] Q: Should the code include detailed comments? In what language?
  Context: Affects readability for the target audience.
  A: English comments explaining each JSON-RPC interaction.

- [x] Q: Should the CLI support multi-line input?
  Context: Users may want to paste multi-line code or prompts.
  A: Yes, support multi-line input via backslash continuation.

- [x] Q: Should there be a `/workflow` command?
  Context: workflow.run is a core bridge method that should be demonstrated.
  A: Yes, include `/workflow <name>` command.
