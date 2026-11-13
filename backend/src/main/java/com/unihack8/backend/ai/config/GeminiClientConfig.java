package com.unihack8.backend.ai.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP client for the Gemini API, with timeouts so a slow model never hangs our API forever. */
@Configuration
@EnableConfigurationProperties({GeminiProperties.class, AiProperties.class})
public class GeminiClientConfig {

    // RestClient pointed at the Gemini API root with the configured timeouts.
    @Bean
    public RestClient geminiHttpClient(GeminiProperties gemini) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(gemini.connectTimeout());
        requestFactory.setReadTimeout(gemini.readTimeout());
        return RestClient.builder()
                .baseUrl(gemini.baseUrl())
                .requestFactory(requestFactory)
                .build();
    }
}
