package com.unihack8.backend.users.service;

public class InvalidSearchException extends RuntimeException {
    // Reports an unusable prefix query.
    public InvalidSearchException() {
        super("Search query must contain at least one character");
    }
}
