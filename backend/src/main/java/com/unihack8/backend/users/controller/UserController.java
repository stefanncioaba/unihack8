package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.dto.UpdateUsernameRequest;
import com.unihack8.backend.users.domain.dto.UsernameAvailabilityResponse;
import com.unihack8.backend.users.service.UserService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** Users and profiles (PLAN 4). Errors use the shared error shape from common.exception. */
@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService users;
    private final CurrentUser currentUser;

    // Provides the public username check and the authenticated profile endpoints.
    public UserController(UserService users, CurrentUser currentUser) {
        this.users = users;
        this.currentUser = currentUser;
    }

    // Public: tells the sign-up screen whether a username is free.
    @GetMapping("/username-available")
    public UsernameAvailabilityResponse usernameAvailable(@RequestParam String username) {
        return users.checkUsername(username);
    }

    // Returns the caller's own profile.
    @GetMapping("/me")
    public ProfileResponse me() {
        return users.getProfile(currentUser.id());
    }

    // Changes the caller's username.
    @PatchMapping("/me")
    public ProfileResponse updateMe(@RequestBody UpdateUsernameRequest request) {
        return users.updateUsername(currentUser.id(), request.username());
    }

    // Searches usernames by case-insensitive prefix.
    @GetMapping("/search")
    public List<ProfileSearchResult> search(@RequestParam String q) {
        return users.search(q);
    }

    // Returns a public profile by Supabase user ID.
    @GetMapping("/{id}")
    public ProfileResponse byId(@PathVariable UUID id) {
        return users.getProfile(id);
    }
}
