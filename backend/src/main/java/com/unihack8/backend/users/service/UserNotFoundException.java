package com.unihack8.backend.users.service;

public class UserNotFoundException extends RuntimeException {
    // Names the missing user in server diagnostics.
    public UserNotFoundException() {
        super("User not found");
    }
}
