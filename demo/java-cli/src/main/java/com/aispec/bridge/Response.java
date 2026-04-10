package com.aispec.bridge;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * JSON-RPC 2.0 response received from the bridge.
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class Response {

    @JsonProperty("jsonrpc")
    private String jsonrpc;

    @JsonProperty("id")
    private long id;

    @JsonProperty("result")
    private Object result;

    @JsonProperty("error")
    private Error error;

    public String getJsonrpc() {
        return jsonrpc;
    }

    public long getId() {
        return id;
    }

    public Object getResult() {
        return result;
    }

    public Error getError() {
        return error;
    }

    public boolean hasError() {
        return error != null;
    }

    /**
     * JSON-RPC error object.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Error {
        @JsonProperty("code")
        private int code;

        @JsonProperty("message")
        private String message;

        @JsonProperty("data")
        private Object data;

        public int getCode() {
            return code;
        }

        public String getMessage() {
            return message;
        }

        public Object getData() {
            return data;
        }
    }
}
