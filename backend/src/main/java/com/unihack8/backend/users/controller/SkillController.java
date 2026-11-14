package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.users.domain.dto.SkillRequest;
import com.unihack8.backend.users.domain.dto.SkillResponse;
import com.unihack8.backend.users.service.SkillService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** The caller's profile skills (PLAN 28). Other users' skills come with their profile (GET /users/{id}). */
@RestController
@RequestMapping("/users/me/skills")
public class SkillController {
    private final SkillService skills;
    private final CurrentUser currentUser;

    // Needs the skill service and the verified caller.
    public SkillController(SkillService skills, CurrentUser currentUser) {
        this.skills = skills;
        this.currentUser = currentUser;
    }

    // My skills, oldest first.
    @GetMapping
    public List<SkillResponse> mine() {
        return skills.skillsOf(currentUser.id());
    }

    // Adds a skill (201).
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public SkillResponse add(@RequestBody SkillRequest request) {
        return skills.add(currentUser.id(), request);
    }

    // Renames a skill or moves it to another category.
    @PatchMapping("/{id}")
    public SkillResponse update(@PathVariable UUID id, @RequestBody SkillRequest request) {
        return skills.update(currentUser.id(), id, request);
    }

    // Removes a skill (204).
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        skills.delete(currentUser.id(), id);
    }
}
