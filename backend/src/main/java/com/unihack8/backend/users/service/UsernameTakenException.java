package com.unihack8.backend.users.service;

public class UsernameTakenException extends RuntimeException {
    // Reports a username conflict consistently for prechecks and database races.
    public UsernameTakenException() {
        super("Username is already taken");
    }
}
