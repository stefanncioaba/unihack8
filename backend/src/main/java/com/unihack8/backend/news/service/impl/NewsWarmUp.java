package com.unihack8.backend.news.service.impl;

import com.unihack8.backend.news.config.NewsProperties;
import com.unihack8.backend.news.service.NewsService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/** Fills the news cache in the background at startup, so the first person to open Home does not wait for slow sites. */
@Component
public class NewsWarmUp {

    private static final Logger log = LoggerFactory.getLogger(NewsWarmUp.class);

    private final NewsService news;
    private final NewsProperties props;

    // Needs the news service and the warm-up switch.
    public NewsWarmUp(NewsService news, NewsProperties props) {
        this.news = news;
        this.props = props;
    }

    // Once the app is ready: read every site on a background thread (errors are only logged).
    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        if (!props.warmUp()) {
            return;
        }
        Thread.ofVirtual().name("news-warm-up").start(() -> {
            try {
                long ok = news.sources().stream().filter(s -> s.available()).count();
                log.info("News warm-up: {} of {} sites read", ok, props.sourcesOrDefault().size());
            } catch (RuntimeException e) {
                log.warn("News warm-up failed: {}", e.getMessage());
            }
        });
    }
}
