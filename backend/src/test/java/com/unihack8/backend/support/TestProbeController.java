package com.unihack8.backend.support;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.security.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Test-only endpoints (lives in src/test, never shipped) used to exercise the shared
 * security and error handling before real features exist.
 */
@RestController
public class TestProbeController {

    private final CurrentUser currentUser;

    // Needs the current-user helper under test.
    public TestProbeController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    // Public path (matches the /transit/** permit rule).
    @GetMapping("/transit/test-probe")
    public Map<String, Object> publicProbe() {
        return Map.of("ok", true, "signedIn", currentUser.optionalId().isPresent());
    }

    // Protected path: returns the caller's id from the token.
    @GetMapping("/test-probe/me")
    public Map<String, String> me() {
        return Map.of("id", currentUser.id().toString());
    }

    // Throws a business error.
    @GetMapping("/test-probe/full")
    public void full() {
        throw new ApiException(ErrorCode.EVENT_FULL);
    }

    // Throws an unexpected error.
    @GetMapping("/test-probe/boom")
    public void boom() {
        throw new IllegalStateException("secret internal detail");
    }

    // Validates a JSON body.
    @PostMapping("/test-probe/body")
    public Map<String, String> body(@Valid @RequestBody ProbeBody body) {
        return Map.of("title", body.title());
    }

    // Applies the paging rules.
    @GetMapping("/test-probe/page")
    public PageParams page(@RequestParam(required = false) Integer page,
                           @RequestParam(required = false) Integer size) {
        return PageParams.of(page, size);
    }

    /** Body used by the validation test. */
    public record ProbeBody(@NotBlank String title, @Positive Integer capacity) {
    }
}
