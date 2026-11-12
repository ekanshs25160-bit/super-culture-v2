---
name: release
description: Ship a new Super Culture APK release by bumping version, tagging, and pushing to GitHub.
---

# Super Culture Release Pipeline

This skill automates the end-to-end release process for Super Culture APK.
When triggered via `/release`, execute the following step-by-step pipeline.

## 1. Version Detection & Selection

1. Read the current version from `frontend/package.json`.
2. Inspect the user's prompt for an optional release target or argument:
   - `patch`: bumps bugfix/patch version (e.g., `2.0.0` -> `2.0.1`)
   - `minor`: bumps minor version (e.g., `2.0.0` -> `2.1.0`)
   - `major`: bumps major version (e.g., `2.0.0` -> `3.0.0`)
   - explicit semver (e.g., `2.1.0` or `v2.1.0`)
3. If no argument was provided in the prompt, ask the user which release type to create:
   - **Patch**: `x.y.z -> x.y.z+1` — Bug fixes & YouTube resolver updates
   - **Minor**: `x.y.z -> x.y+1.0` — New features & UI upgrades
   - **Major**: `x.y.z -> x+1.0.0` — Major architectural or breaking changes
   - **Custom**: Prompt for specific semantic version

## 2. Pre-flight Cleanliness Check

1. Run `git status --porcelain` to verify working tree status.
2. If there are uncommitted changes:
   - Ask the user whether to:
     - **Include in Release**: Stage with the release commit.
     - **Stash Changes**: Stash them safely before release (`git stash push -u -m "Pre-release stash for v<version>"`).
     - **Abort**: Stop the release to let the user review files manually.

## 3. Version Bump

1. Update the `"version"` field in `frontend/package.json` to the target version `<newVersion>`.
2. If `package.json` exists in the repository root, update its `"version"` field to `<newVersion>` as well.
3. Keep formatting clean (2-space JSON indentation).

## 4. Git Commit, Tag, and Push

1. Stage modified version and package files:
   ```bash
   git add frontend/package.json package.json frontend/package-lock.json
   ```
   *(If the user chose to include all uncommitted changes, stage all with `git add -A`)*.
2. Commit with standard release message:
   ```bash
   git commit -m "chore(release): v<newVersion>"
   ```
3. Create the release tag:
   ```bash
   git tag "v<newVersion>"
   ```
4. Push HEAD and the new tag to GitHub:
   ```bash
   git push origin HEAD --tags
   ```

## 5. Verification & GitHub Actions Link

1. Verify that `git push` succeeded.
2. Present a completion summary to the user:
   - **Release Version**: `v<newVersion>`
   - **Git Tag**: `v<newVersion>`
   - **GitHub Actions**: Direct link to monitor APK build and signing:
     [View GitHub Actions Pipeline](https://github.com/ekanshs25160-bit/super-culture-v2/actions)
3. Remind user that once CI finishes, the standalone APK `super-culture-<newVersion>.apk` will be attached to the new GitHub Release automatically.
