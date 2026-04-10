package com.aispec.ui;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;

/**
 * Multi-line input reader with backslash continuation support.
 */
public class MultiLineReader {

    private final BufferedReader reader;

    public MultiLineReader() {
        this.reader = new BufferedReader(new InputStreamReader(System.in));
    }

    /**
     * Reads a single line with the given prompt.
     *
     * @param prompt The prompt to display
     * @return The line read, or null if EOF
     * @throws IOException if an I/O error occurs
     */
    public String readLine(String prompt) throws IOException {
        System.out.print(prompt);
        System.out.flush();
        return reader.readLine();
    }

    /**
     * Reads multi-line input with backslash continuation.
     * Lines ending with \ are continued on the next line.
     *
     * @param prompt The initial prompt
     * @return The complete input, or null if EOF at start
     * @throws IOException if an I/O error occurs
     */
    public String readMultiLine(String prompt) throws IOException {
        StringBuilder result = new StringBuilder();
        String currentPrompt = prompt;

        while (true) {
            System.out.print(currentPrompt);
            System.out.flush();

            String line = reader.readLine();
            if (line == null) {
                // EOF
                return result.isEmpty() ? null : result.toString();
            }

            if (line.endsWith("\\")) {
                // Continuation line - remove backslash and continue
                result.append(line, 0, line.length() - 1).append("\n");
                currentPrompt = "... ";
            } else {
                // Final line
                result.append(line);
                return result.toString();
            }
        }
    }

    /**
     * Checks if input is available without blocking.
     *
     * @return true if input is available
     * @throws IOException if an I/O error occurs
     */
    public boolean ready() throws IOException {
        return reader.ready();
    }
}
