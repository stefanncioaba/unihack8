package com.unihack8.backend.places.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Registers the places.import.* settings. */
@Configuration
@EnableConfigurationProperties(PlaceImportProperties.class)
public class PlaceImportConfig {
}
