# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
This project uses [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] – 2026-03-28
### Added
- Beta drawing tools: lane closure mask (M), crosswalk (C), turn lane (L), road shoulders & sidewalks (#17, #18, #19, #20)
- Export preview modal with QC summary before PDF/PNG download (#119)
- MUTCD-style QC rule checks with live panel (#114)
- Template library with starter TCP templates (#111)
- Landing page as site root with multi-page Vite build (#141)
- Pre-beta banner with dismissal persistence (#137, #138)
- PostHog analytics for beta user tracking (#134)
- Searchable sign library with MUTCD codes (#25)
- Intersection editor with snap-to-segment and gap-free junctions (#16)
- App version badge in status bar

### Fixed
- Sign editor placing wrong sign on canvas (#158)

### Chore
- Removed backend/.aws-sam build artifacts from version control

## [0.2.0] – 2026-03-26
### Added
- AWS Amplify authentication (Cognito sign-up/sign-in/sign-out) (#81, #82, #83)
- Cloud plan save and load via S3 storage (#63, #76)
- Staging environment infrastructure and Amplify config (#150)
- Playwright E2E test suite and GitHub Actions CI workflow (#150)
- Gemini + Copilot AI code review workflows
- Custom auth header and dark theme for Amplify UI

### Fixed
- Sign-out now revokes Cognito refresh token server-side to prevent auto-login (#152)
- Auth form error text contrast on dark background (#147)
- Sign-up name field mapping for Cognito schema (#148)
- S3 bucket public access block for sign assets (#150)

## [0.1.0] – 2026-02-17
### Added
- Initial traffic control planner canvas (roads, signs, devices, work zones, arrows, text, measurements)
- Straight, polyline, smooth, quad-bezier, and cubic-bezier road drawing modes
- Taper tool with MUTCD lane-closure formula (#10)
- Custom sign library with localStorage persistence
- Local plan save/load as .tcp.json file
- Address geocoding with map tile overlay
- React-Konva rendering layer migration
- Vitest unit test framework
- TypeScript migration with strict mode (#27)

[Unreleased]: https://github.com/jfisher94002/TrafficControlPlanner/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/jfisher94002/TrafficControlPlanner/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/jfisher94002/TrafficControlPlanner/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/jfisher94002/TrafficControlPlanner/releases/tag/v0.1.0
