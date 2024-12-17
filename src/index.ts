#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import { execa } from 'execa';
import chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Convert import.meta.url to __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Utility to read template files, replace variables, and write output
function processTemplate(templatePath: string, outputPath: string, variables: { [key: string]: string }) {
  const templateContent = fs.readFileSync(templatePath, 'utf8');
  const processedContent = templateContent.replace(/{{(\w+)}}/g, (_, key) => variables[key] || '');

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });  // Create directories if they don't exist

  fs.writeFileSync(outputPath, processedContent);
}

// Initialize Commander
const program = new Command();

program
  .name('angular-standards-cli')
  .description('CLI to create Angular projects with custom standards and configurations')
  .version('1.0.0');

// Command: create
program
  .command('create <project-name>')
  .description('Create a new Angular project with custom standards')
  .action(async (projectName: string) => {
    console.log(chalk.green(`\nCreating Angular project: ${projectName}...\n`));

    try {
      // Step 1: Create Angular project
      await execa('npx', ['@angular/cli', 'new', projectName, '--routing', '--style=scss'], { stdio: 'inherit' });
      process.chdir(projectName);

      // Modify package.json to include scripts
      modifyPackageJson(projectName);

      // Modify angular.json to add assets configuration
      modifyAngularJsonAssets(projectName);

      // Step 2: PrimeNG Setup
      const { addPrimeNG } = await inquirer.prompt({
        type: 'confirm',
        name: 'addPrimeNG',
        message: 'Would you like to install PrimeNG?',
        default: true,
      });

      if (addPrimeNG) {
        await addPrimeNGSupport();
      }

      // Step 3: CI/CD Setup
      const { ciChoice } = await inquirer.prompt({
        type: 'list',
        name: 'ciChoice',
        message: 'Which CI/CD setup would you like?',
        choices: ['GitHub', 'GitLab'],
      });

      if (ciChoice === 'GitHub') {
        await setupCI('github', projectName);
      } else {
        await setupCI('gitlab', projectName);
      }

      // Step 4: Docker and NGINX Setup
      await setupDocker(projectName);

      // Step 5: Add .env and environment files
      await addEnvFiles(projectName);

      // Step 6: Linting, Prettier, and Pull Request Template Setup
      await setupLintingAndPrettier(projectName);
      await setupPullRequestTemplate();
      await createFolderStructure(projectName);
      await setupI18n(projectName);

      await execa('npm', ['run', 'prettier-format']);
      console.log(chalk.green(`\nProject ${projectName} created successfully with all configurations!\n`));
    } catch (err: any) {
      console.error(chalk.red(`\nFailed to create Angular project: ${err.message}\n`));

      // Step 7: Delete the project folder if error occurs
      try {
        const projectPath = path.join(process.cwd(), projectName);
        await fs.promises.rm(projectPath, { recursive: true, force: true });
        console.log(chalk.yellow(`\nDeleted incomplete project folder: ${projectName}\n`));
      } catch (deleteErr: any) {
        console.error(chalk.red(`\nFailed to delete project folder: ${deleteErr.message}\n`));
      }
    }
  });

// Modify angular.json assets folder
function modifyAngularJsonAssets(projectName: string) {
  const angularJsonPath = path.join(process.cwd(), 'angular.json');
  const angularJson = JSON.parse(fs.readFileSync(angularJsonPath, 'utf8'));

  if (angularJson && angularJson.projects && angularJson.projects[projectName]) {
    const assetsConfig = {
      "glob": "**/*",
      "input": "src/assets"
    };

    if (angularJson.projects[projectName].architect.build.options.assets) {
      angularJson.projects[projectName].architect.build.options.assets.push(assetsConfig);
    } else {
      angularJson.projects[projectName].architect.build.options.assets = [assetsConfig];
    }
  }

  fs.writeFileSync(angularJsonPath, JSON.stringify(angularJson, null, 2));
  console.log(chalk.green('\nUpdated angular.json to include assets folder configuration!\n'));
}

// PrimeNG Setup
async function addPrimeNGSupport() {
  console.log(chalk.blue('\nInstalling PrimeNG...'));
  await execa('npm', ['install', 'primeng', 'primeflex', 'primeicons'], { stdio: 'inherit' });

  const stylesPath = 'src/styles.scss';
  const primeStyles = `
/* PrimeNG */
@import "primeng/resources/themes/lara-light-blue/theme.css";
@import "primeng/resources/primeng.css";

/* PrimeIcons */
@import "primeicons/primeicons.css";

/* PrimeFlex */
@import "../node_modules/primeflex/primeflex.css";
  `;
  fs.appendFileSync(stylesPath, primeStyles);

  console.log(chalk.green('\nPrimeNG styles added to styles.css!\n'));
}

// Modify package.json scripts
function modifyPackageJson(projectName: string) {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

  packageJson.scripts = {
    ...packageJson.scripts,
    "build:prod": "ng build --configuration production",
    "watch": "ng build --watch --configuration development",
    "lint": "ng lint --max-warnings=0",
    "lint:fix": "ng lint --fix",
    "prettier-format": "prettier --ignore-path .gitignore --write \"**/*.+(js|ts|json)\"",
    "lint-fix-format": "npm run prettier-format && npm run lint:fix && npm run prettier-format"
  };

  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
}

// CI Setup
async function setupCI(type: string, projectName: string) {
  const templatePath = path.join(__dirname, '..', 'templates', `${type}-ci.yml`);
  const outputPath = type === 'github' ? '.github/workflows/ci.yml' : '.gitlab-ci.yml';

  console.log(chalk.blue(`\nSetting up ${type.toUpperCase()} CI/CD...`));
  processTemplate(templatePath, outputPath, { projectName });
  if (type === 'github') {
    // Add CD setup for GitHub
    processTemplate(
      path.join(__dirname, '..', 'templates', `github-cd.yml`),
      '.github/workflows/cd.yml',
      { projectName }
    );
  }
  console.log(chalk.green(`\n${type.toUpperCase()} CI/CD configuration added!\n`));
}

// Docker and NGINX Setup
async function setupDocker(projectName: string) {
  console.log(chalk.blue('\nSetting up Docker and NGINX...'));

  const dockerfileTemplatePath = path.join(__dirname, '..', 'templates', 'Dockerfile');
  const dockerComposeTemplatePath = path.join(__dirname, '..', 'templates', 'docker-compose.yml');
  const nginxTemplatePath = path.join(__dirname, '..', 'templates', 'nginx.conf');
  const dockerignoreTemplatePath = path.join(__dirname, '..', 'templates', '.dockerignore');

  processTemplate(dockerfileTemplatePath, 'Dockerfile', { projectName });
  processTemplate(dockerComposeTemplatePath, 'docker-compose.yml', { projectName });
  processTemplate(nginxTemplatePath, 'nginx.conf', { projectName });
  processTemplate(dockerignoreTemplatePath, '.dockerignore', {});

  console.log(chalk.green('\nDocker and NGINX setup completed!\n'));
}

// Add .env and .env.example files
async function addEnvFiles(projectName: string) {
  const envExampleTemplatePath = path.join(__dirname, '..', 'templates', '.env.example');

  // Process and copy .env.example as .env.example and .env into the Angular project directory
  processTemplate(envExampleTemplatePath, '.env.example', { projectName });
  processTemplate(envExampleTemplatePath, '.env', { projectName });

  // Add Angular environment files
  await execa('ng', ['generate', 'environments'], { stdio: 'inherit' });

  console.log(chalk.green('\nEnvironment files added!\n'));
}

// Linting, Prettier, and Airbnb Setup
async function setupLintingAndPrettier(projectName: string) {
  console.log(chalk.blue('\nSetting up ESLint, Prettier, and Airbnb Rules...\n'));

  // Step 1: Initialize ESLint configuration
  await execa('npm', ['init', '@eslint/config'], { stdio: 'inherit' });
  await execa('npm', ['install', 'eslint@^8.56.0'])
  // Step 2: Install TypeScript and Airbnb-specific ESLint dependencies
  await execa('npm', ['install', 'eslint-config-airbnb-typescript@^18.0.0', '@typescript-eslint/eslint-plugin@^7.0.0', '@typescript-eslint/parser@^7.0.0', '--save-dev'], { stdio: 'inherit' });

  // Step 3: Install Prettier and related ESLint configurations
  await execa('npm', ['install', 'prettier', 'eslint-config-prettier', 'eslint-plugin-prettier', '--save-dev'], { stdio: 'inherit' });

  // Step 4: Integrate Angular ESLint schematics
  await execa('ng', ['add', '@angular-eslint/schematics'], { stdio: 'inherit' });

  // Step 5: Copy ESLint, Prettier, and tsconfig for ESLint from templates
  const eslintConfigTemplatePath = path.join(__dirname, '..', 'templates', '.eslintrc.json');
  const prettierConfigTemplatePath = path.join(__dirname, '..', 'templates', '.prettierrc.json');
  const tsconfigEslintTemplatePath = path.join(__dirname, '..', 'templates', 'tsconfig.eslint.json');
  const vscodeSettingsTemplatePath = path.join(__dirname, '..', 'templates', 'vscode-settings.json');

  processTemplate(eslintConfigTemplatePath, '.eslintrc.json', {});
  processTemplate(prettierConfigTemplatePath, '.prettierrc.json', {});
  processTemplate(tsconfigEslintTemplatePath, 'tsconfig.eslint.json', {});

  // Step 6: Setup VSCode settings for formatting on save
  const vscodeDir = path.join('.vscode');
  fs.mkdirSync(vscodeDir, { recursive: true });
  processTemplate(vscodeSettingsTemplatePath, path.join(vscodeDir, 'settings.json'), {});

  console.log(chalk.green('\nESLint, Prettier, and Airbnb configuration added!\n'));
}

// Copy Pull Request template
async function setupPullRequestTemplate() {
  console.log(chalk.blue('\nSetting up Pull Request Template...\n'));

  const templatePath = path.join(__dirname, '..', 'templates', 'pull_request_template.md');
  const outputPath = path.join('.github', 'pull_request_template.md');

  processTemplate(templatePath, outputPath, {});

  console.log(chalk.green('\nPull Request Template added!\n'));
}

async function createFolderStructure(projectName: string) {
  console.log(chalk.blue('\nCreating project folder structure...\n'));

  // Folders to create
  const foldersToCreate = [
    'src/assets',
    'src/app/core/constants',
    'src/app/core/guards',
    'src/app/core/interceptors',
    'src/app/core/interfaces',
    'src/app/core/services',
    'src/app/core/utils',
    'src/app/features/components',
    'src/app/features/models',
    'src/app/features/pages',
    'src/app/features/services',
    'src/app/shared/components',
    'src/app/shared/directives',
    'src/app/shared/pipes',
    'src/app/styles',
    'src/declarations',
    'src/assets/icons',
    'src/assets/images',
  ];

  // Create folders and add .gitkeep for empty ones
  foldersToCreate.forEach((folder) => {
    const folderPath = path.join(folder);
    fs.mkdirSync(folderPath, { recursive: true });

    // Add .gitkeep to empty folders
    if(!folderPath.includes('declarations')) {
      fs.writeFileSync(path.join(folderPath, '.gitkeep'), '');
    } else {
      fs.writeFileSync(path.join(folderPath, 'scripts.d.ts'), '// Declaration file for external scripts');
    }
  });

  console.log(chalk.green('\nFolders created successfully!\n'));

  // Step 2: Add FOLDER_STRUCTURE.md from templates to the project root
  const folderStructureTemplatePath = path.join(__dirname, '..', 'templates', 'FOLDER_STRUCTURE.md');
  const folderStructureOutputPath = path.join('FOLDER_STRUCTURE.md');

  processTemplate(folderStructureTemplatePath, folderStructureOutputPath, {});

  console.log(chalk.green('\nFOLDER_STRUCTURE.md added successfully!\n'));
}

async function setupI18n(projectName: string) {
  console.log(chalk.blue('\nSetting up i18n (internationalization) support...\n'));

 await execa('npm', ['install', 'eslint@^8.56.0'])

 // Step 1: Install ngx-translate packages
 await execa('npm', ['install', '@ngx-translate/core', '@ngx-translate/http-loader'], { stdio: 'inherit' });

 // Step 2: Copy loader.ts from templates
 const loaderTemplatePath = path.join(__dirname, '..', 'templates', 'loader.ts');
 const loaderOutputPath = path.join('src/assets/i18n/loader.ts');
 processTemplate(loaderTemplatePath, loaderOutputPath, {});

 // Step 3: Create i18n folder and add the en.json with structure
 const i18nDir = path.join('src/assets/i18n');
 fs.mkdirSync(i18nDir, { recursive: true });

 // Create i18n JSON file with BRAND_NAME and HELLO
 const enJsonContent = `{
   "COMMON": {
     "BRAND_NAME": "${toTitleCase(projectName)}",
     "HELLO": "Hello"
   }
 }`;

 fs.writeFileSync(path.join(i18nDir, 'en.json'), enJsonContent);

 // Step 4: Update AppComponent with TranslateService and RouterOutlet
 const appComponentTs = `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, TranslateModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent {
  title = '${toTitleCase(projectName)}';

  constructor(private translate: TranslateService) {
    // Set default language
    this.translate.setDefaultLang('en');
  }
}
 `;

 const appComponentHtml = `
 <div class="p-card p-3">
  <div class="flex align-items-center justify-content-center">
    <i class="pi pi-globe mr-2"></i>
    <h1>{{ 'COMMON.HELLO' | translate }}, {{ 'COMMON.BRAND_NAME' | translate }}!</h1>
  </div>
 </div>

 <!-- Router Outlet -->
 <router-outlet></router-outlet>
 `;

 const appConfig = `import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import HttpLoaderFactory from '../assets/i18n/loader';

export const appConfig: ApplicationConfig = {
  providers: [provideZoneChangeDetection({ eventCoalescing: true }), provideRouter(routes), provideHttpClient(), importProvidersFrom(
    TranslateModule.forRoot({
      defaultLanguage: 'en',
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient],
      },
    })
  ),]
};
`
 // Step 5: Write the updated AppComponent and HTML
 const appComponentHtmlPath = path.join('src/app/app.component.html');
 const appComponentTsPath = path.join('src/app/app.component.ts');
 const appConfigTsPath = path.join('src/app/app.config.ts');

 fs.writeFileSync(appComponentHtmlPath, appComponentHtml);
 fs.writeFileSync(appComponentTsPath, appComponentTs);
 fs.writeFileSync(appConfigTsPath, appConfig);

 console.log(chalk.green('\ni18n setup completed successfully!\n'));
}

function toTitleCase(str: string) {
  return str.replace(/-/g, ' ').replace(
    /\w\S*/g,
    text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
  );
}

// Parse CLI arguments
program.parse(process.argv);
