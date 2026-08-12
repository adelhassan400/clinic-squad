# ClinicSquad

ClinicSquad is a comprehensive, full-stack monorepo application designed to streamline clinic operations, patient management, and administrative workflows. Built with a modern TypeScript stack, it combines a responsive React frontend with robust backend services and shared database models.

## Architecture and Project Structure

The project is structured as a `pnpm` monorepo, ensuring clean separation of concerns between client applications, backend services, and shared libraries:

| Directory | Component | Description |
| :--- | :--- | :--- |
| **`artifacts/clinic-squad`** | Frontend Application | React Single Page Application built with Vite and styled using Tailwind CSS. |
| **`artifacts/api-server`** | Backend API | Server application handling core business logic and API routing. |
| **`lib/db`** | Database Layer | Shared database schemas, models, and connection utilities. |
| **`lib/api-zod`** | Validation Schemas | Zod validation schemas ensuring type safety across client and server. |
| **`lib/api-spec`** | API Specifications | Interface definitions and specifications. |
| **`lib/api-client-react`** | API Client | Generated or customized React hooks and client for API consumption. |

## Technology Stack

* **Frontend:** React, Vite, TypeScript, Tailwind CSS, Lucide icons.
* **Backend & Validation:** Node.js, TypeScript, Zod.
* **Monorepo Management:** `pnpm` workspaces with strict TypeScript project references.

## Getting Started

### Prerequisites

Ensure you have the following installed on your local environment:
* Node.js (v18+)
* `pnpm` package manager

### Installation and Setup

Clone the repository and install dependencies using `pnpm`:

```bash
git clone https://github.com/adelhassan400/clinic-squad.git
cd clinic-squad
pnpm install
```

### Type Checking and Building

To run type checking across all monorepo packages, execute:

```bash
pnpm run typecheck
```

To build all packages and applications in the correct dependency order:

```bash
pnpm run build
```

## License

This project is licensed under the MIT License.
