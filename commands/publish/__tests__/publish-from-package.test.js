"use strict";

// local modules _must_ be explicitly mocked
jest.mock("../lib/get-packages-without-license");
jest.mock("../lib/verify-npm-package-access");
jest.mock("../lib/get-npm-username");
jest.mock("../lib/get-unpublished-packages");
// FIXME: better mock for version command
jest.mock("../../version/lib/git-push");
jest.mock("../../version/lib/is-anything-committed");
jest.mock("../../version/lib/is-behind-upstream");
jest.mock("../../version/lib/remote-branch-exists");

// mocked or stubbed modules
const npmPublish = require("@lerna/npm-publish");
const PromptUtilities = require("@lerna/prompt");
const output = require("@lerna/output");
const checkWorkingTree = require("@lerna/check-working-tree");
const getUnpublishedPackages = require("../lib/get-unpublished-packages");

// helpers
const loggingOutput = require("@lerna-test/logging-output");
const initFixture = require("@lerna-test/init-fixture")(__dirname);

// file under test
const lernaPublish = require("@lerna-test/command-runner")(require("../command"));

expect.extend(require("@lerna-test/figgy-pudding-matchers"));

describe("publish from-package", () => {
  it("publishes unpublished packages", async () => {
    const cwd = await initFixture("normal");

    getUnpublishedPackages.mockImplementationOnce(packageGraph => {
      const pkgs = packageGraph.rawPackageList.slice(1, 3);
      return pkgs.map(pkg => packageGraph.get(pkg.name));
    });

    await lernaPublish(cwd)("from-package");

    expect(PromptUtilities.confirm).toHaveBeenLastCalledWith(
      "Are you sure you want to publish these packages?"
    );
    expect(output.logged()).toMatch("Found 2 packages to publish:");
    expect(npmPublish.order()).toEqual(["package-2", "package-3"]);
  });

  it("publishes unpublished independent packages", async () => {
    const cwd = await initFixture("independent");

    getUnpublishedPackages.mockImplementationOnce(packageGraph => Array.from(packageGraph.values()));

    await lernaPublish(cwd)("from-package");

    expect(npmPublish.order()).toEqual([
      "package-1",
      "package-3",
      "package-4",
      "package-2",
      // package-5 is private
    ]);
  });

  it("exits early when all packages are published", async () => {
    const cwd = await initFixture("normal");

    await lernaPublish(cwd)("from-package");

    expect(npmPublish).not.toHaveBeenCalled();

    const logMessages = loggingOutput("info");
    expect(logMessages).toContain("No unpublished release found");
  });

  it("throws an error when uncommitted changes are present", async () => {
    checkWorkingTree.throwIfUncommitted.mockImplementationOnce(() => {
      throw new Error("uncommitted");
    });

    const cwd = await initFixture("normal");

    try {
      await lernaPublish(cwd)("from-package");
    } catch (err) {
      expect(err.message).toBe("uncommitted");
      // notably different than the actual message, but good enough here
    }

    expect.assertions(1);
  });
});
