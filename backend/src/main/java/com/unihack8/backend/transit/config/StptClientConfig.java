package com.unihack8.backend.transit.config;

import java.net.http.HttpClient;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** HTTP client used only to call live.stpt.ro, with timeouts. */
@Configuration
@EnableConfigurationProperties(StptProperties.class)
public class StptClientConfig {

    // RestClient pointed at STPT with connect/read timeouts and our User-Agent.
    @Bean
    public RestClient stptRestClient(StptProperties props) {
        HttpClient http = HttpClient.newBuilder()
                .connectTimeout(props.connectTimeout())
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(http);
        factory.setReadTimeout(props.readTimeout());
        return RestClient.builder()
                .baseUrl(props.baseUrl())
                .requestFactory(factory)
                .defaultHeader(HttpHeaders.USER_AGENT, props.userAgent())
                .build();
    }
}
