package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.CurrentUser;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.dto.UpdateUsernameRequest;
import com.unihack8.backend.users.service.UserService;
import jakarta.validation.Valid;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/users")
public class UserController {
    private final UserService users;
    private final CurrentUser currentUser;

    // Provides authenticated and public profile endpoints.
    public UserController(UserService users, CurrentUser currentUser) {
        this.users = users;
        this.currentUser = currentUser;
    }

    // Returns the caller's own profile.
    @GetMapping("/me")
    public ProfileResponse me(@AuthenticationPrincipal Jwt jwt) {
        return users.getOwnProfile(currentUser.id(jwt));
    }

    // Changes the caller's username.
    @PatchMapping("/me")
    public ProfileResponse updateMe(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody UpdateUsernameRequest request) {
        return users.updateUsername(currentUser.id(jwt), request.username());
    }

    // Searches usernames by case-insensitive prefix.
    @GetMapping("/search")
    public List<ProfileSearchResult> search(@RequestParam String q) {
        return users.search(q);
    }

    // Returns a public profile by Supabase user ID.
    @GetMapping("/{id}")
    public ProfileResponse byId(@PathVariable UUID id) {
        return users.getPublicProfile(id);
    }
}
