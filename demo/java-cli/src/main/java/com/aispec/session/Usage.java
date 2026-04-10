package com.aispec.session;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Token usage statistics for a session.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Usage {

    @JsonProperty("inputTokens")
    private int inputTokens;

    @JsonProperty("outputTokens")
    private int outputTokens;

    public int getInputTokens() {
        return inputTokens;
    }

    public void setInputTokens(int inputTokens) {
        this.inputTokens = inputTokens;
    }

    public int getOutputTokens() {
        return outputTokens;
    }

    public void setOutputTokens(int outputTokens) {
        this.outputTokens = outputTokens;
    }

    @Override
    public String toString() {
        return "input=" + inputTokens + " output=" + outputTokens;
    }
}
