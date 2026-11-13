package com.unihack8.backend.common.exception;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.support.JwtTestTokens;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** Every error comes back in the standard shape from docs/API.md (PLAN 3.4). */
@SpringBootTest
@AutoConfigureMockMvc
class GlobalExceptionHandlerTest {

    private static final String AUTH = "Bearer " + JwtTestTokens.valid(UUID.randomUUID());

    @Autowired
    private MockMvc mvc;

    // ApiException keeps its code, status and default message.
    @Test
    void apiExceptionUsesItsCodeAndStatus() throws Exception {
        mvc.perform(get("/test-probe/full").header("Authorization", AUTH))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("EVENT_FULL"))
                .andExpect(jsonPath("$.message").value(ErrorCode.EVENT_FULL.defaultMessage()))
                .andExpect(jsonPath("$.fields").doesNotExist())
                .andExpect(jsonPath("$.path").value("/test-probe/full"))
                // ISO-8601 in UTC, as promised in docs/API.md -> Conventions.
                .andExpect(jsonPath("$.timestamp").value(matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z")));
    }

    // Invalid body fields are listed one by one.
    @Test
    void invalidBodyListsFields() throws Exception {
        mvc.perform(post("/test-probe/body").header("Authorization", AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"  \",\"capacity\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.title").exists())
                .andExpect(jsonPath("$.fields.capacity").exists());
    }

    // Broken JSON is a validation error, not a 500.
    @Test
    void malformedJsonIs400() throws Exception {
        mvc.perform(post("/test-probe/body").header("Authorization", AUTH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{not json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Wrong parameter type is a validation error naming the parameter.
    @Test
    void wrongParameterTypeIs400() throws Exception {
        mvc.perform(get("/test-probe/page").param("page", "abc").header("Authorization", AUTH))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.page").exists());
    }

    // Paging limits from docs/API.md are enforced.
    @Test
    void pageSizeOverLimitIs400() throws Exception {
        mvc.perform(get("/test-probe/page").param("size", "101").header("Authorization", AUTH))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Unknown path for a signed-in user is 404 NOT_FOUND.
    @Test
    void unknownPathIs404() throws Exception {
        mvc.perform(get("/does-not-exist").header("Authorization", AUTH))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    // Wrong HTTP method is 405 METHOD_NOT_ALLOWED.
    @Test
    void wrongMethodIs405() throws Exception {
        mvc.perform(post("/test-probe/full").header("Authorization", AUTH))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    // Unexpected errors answer 500 without leaking internal details.
    @Test
    void unexpectedErrorIs500WithoutDetails() throws Exception {
        mvc.perform(get("/test-probe/boom").header("Authorization", AUTH))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("secret internal detail"))));
    }
}
