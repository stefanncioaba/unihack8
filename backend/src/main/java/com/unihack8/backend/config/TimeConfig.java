package com.unihack8.backend.config;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Shared clock, so code that needs "now" can be tested with a fixed time. */
@Configuration
public class TimeConfig {

    // System clock in UTC; tests replace it with Clock.fixed(...).
    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
