package com.unihack8.backend.eventimport.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Registers the events import settings. */
@Configuration
@EnableConfigurationProperties(EventImportProperties.class)
public class EventImportConfig {
}
