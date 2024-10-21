# Angular Standards CLI

The `angular-standards-cli` is a tool designed to help developers create Angular projects with predefined standards, configurations, and best practices. This CLI allows you to quickly set up a new Angular project with customized options for testing, linting, CI/CD configurations, and more.

## Features

- **Project Setup**: Quickly scaffold an Angular project with standards-based configurations.
- **Linting and Formatting**: Automatically configures ESLint with Airbnb rules, Prettier formatting, and custom linting rules.
- **CI/CD Integration**: Automatically sets up GitHub Actions or GitLab CI pipelines.
- **PrimeNG Support**: Option to include PrimeNG with necessary styles and configuration.
- **Docker Support**: Includes Dockerfile and Docker Compose setup for containerizing your Angular application.
- **Folder Structure**: Optionally set up a predefined folder structure for maintainability and scalability.
- **i18n Support**: Includes internationalization (i18n) setup with translations.
- **Environment Files**: Automatically creates `.env`, `.env.example`, and Angular environment files for better configuration management.

## Installation

To install `angular-standards-cli` locally, follow these steps:

```bash
git clone <repo-url>
cd angular-standards-cli
npm install
npm link angular-standards-cli  # Links the CLI tool globally
```

Now, you can use `angular-standards-cli` as a global command.

## Usage

### Creating a New Angular Project

To create a new Angular project using the CLI, run:

```bash
angular-standards-cli create <project-name>
```

This command will walk you through a series of prompts to configure the project:

1. **Choose CI/CD Platform**: Select between GitHub Actions or GitLab CI for continuous integration and deployment.
2. **PrimeNG Setup**: Option to install and configure PrimeNG, including styles and necessary dependencies.
3. **Docker Support**: Automatically sets up Docker and Docker Compose for containerizing the Angular project.
4. **Linting and Prettier Configuration**: Sets up ESLint with Airbnb rules and Prettier for code formatting.
5. **i18n Setup**: Configures internationalization (i18n) support and sets up default translation files.
6. **Folder Structure**: Option to set up a modular folder structure with `core`, `shared`, `features`, etc.

### Example Command

```bash
angular-standards-cli create my-angular-project
```

This will:

1. Scaffold a new Angular project.
2. Set up CI/CD pipelines.
3. Optionally install PrimeNG.
4. Configure ESLint, Prettier, Docker, and i18n support.

## Project Configuration

After the project is created, you will find several configurations automatically set up:

### 1. **CI/CD Configurations**

Depending on your selection, either `.github/workflows/ci.yml` for GitHub Actions or `.gitlab-ci.yml` for GitLab will be set up. These configurations include:

- Building the Angular project
- Running lint checks
- Deploying to AWS Lambda (if applicable)

### 2. **Linting and Formatting**

The project includes an ESLint configuration following Airbnb’s TypeScript style guide, along with Prettier for code formatting. The following scripts will be added to `package.json`:

```json
"scripts": {
  "build:prod": "ng build --configuration production",
  "watch": "ng build --watch --configuration development",
  "lint": "ng lint --max-warnings=0",
  "lint:fix": "ng lint --fix",
  "prettier-format": "prettier --ignore-path .gitignore --write \"**/*.+(js|ts|json)\"",
  "lint-fix-format": "npm run prettier-format && npm run lint:fix && npm run prettier-format"
}
```

### 3. **Docker Setup**

A Dockerfile and Docker Compose configuration are included for containerization. The Docker setup assumes you’re deploying the Angular app in a production-ready Docker container using NGINX.

### 4. **i18n Support**

i18n (internationalization) is pre-configured with an initial setup of translation files in `src/assets/i18n/`. The default translation files for English (`en.json`) will be created. You can expand this to other languages as needed.

### 5. **Environment Files**

The CLI automatically generates `.env` and `.env.example` files in the root directory for storing environment variables. Angular environment files (`environment.ts` and `environment.prod.ts`) will also be created in the `src/environments/` directory.

## Development

To develop and test the CLI locally:

1. Clone the repository and navigate to its directory.
2. Run `npm install` to install the dependencies.
3. Use `npm link` to link the command globally for local testing.

If you make any changes, you can unlink the CLI with:

```bash
npm unlink
```