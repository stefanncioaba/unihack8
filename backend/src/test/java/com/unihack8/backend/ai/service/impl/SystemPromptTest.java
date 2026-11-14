package com.unihack8.backend.ai.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.common.geo.GeoPoint;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** The system prompt carries the strict scope rule (PLAN 19.1-19.3, 19.5). */
class SystemPromptTest {

    private static final Instant NOW = Instant.parse("2026-11-14T16:00:00Z");

    // The scope section is in the prompt, before the numbered rules, with or without a location.
    @Test
    void promptCarriesScopeBeforeRules() {
        for (GeoPoint location : new GeoPoint[] {new GeoPoint(45.75, 21.22), null}) {
            String prompt = SystemPrompt.build(new ToolContext(location, NOW));
            assertThat(prompt).contains(SystemPrompt.SCOPE);
            assertThat(prompt.indexOf("Scope (strict")).isLessThan(prompt.indexOf("Rules:"));
            assertThat(prompt).doesNotContain("%s");
        }
    }

    // 19.1: lists what is in scope, what is not, refusal examples, one sentence and no tool calls.
    @Test
    void scopeListsInAndOut() {
        assertThat(SystemPrompt.SCOPE)
                .contains("IN SCOPE", "OUT OF SCOPE")
                .contains("public transport", "directions", "events", "food")
                .contains("code", "maths", "homework", "essays", "translations", "general chat")
                .contains("one short sentence", "language of the user's last message", "NO tools");
    }

    // 19.2: jailbreaks, role-play and city-wrapped tasks are named as still refused.
    @Test
    void scopeCannotBeTalkedOutOf() {
        assertThat(SystemPrompt.SCOPE)
                .contains("ignore your instructions")
                .contains("role-play", "pretend you are a programmer")
                .contains("write Python code that lists Timisoara trams")
                .contains("What counts is the task asked for");
    }

    // 19.3: follow-ups judged with the conversation; mixed messages answered in part.
    @Test
    void scopeDoesNotOverRefuse() {
        assertThat(SystemPrompt.SCOPE)
                .contains("Do not over-refuse", "and the second one?", "is it open now?", "whole conversation")
                .contains("A mixed message", "answer the in-scope part");
    }
}
