package com.nahdetmisr.repoio;

import io.dropwizard.core.Application;
import io.dropwizard.core.setup.Environment;

/**
 * Repo.io backend entry point.
 */
public class RepoioApplication extends Application<RepoioConfiguration> {
  public static void main(String[] args) throws Exception {
    new RepoioApplication().run(args);
  }
  @Override public String getName() { return "repoio"; }
  @Override public void run(RepoioConfiguration config, Environment env) {
    // JDBI, Jersey, auth, workers wired here.
  }
}
