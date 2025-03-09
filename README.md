# DB2LLM Minimal Prototype

## Overview
DB2LLM is a minimal prototype that combines SQLite database metadata with RESTful APIs and large language models (LLMs). It allows users to interact with databases using natural language, without writing SQL queries or understanding database structures. Currently, SQLite is used for demonstration purposes. For actual use, please use your own database and update the relevant configurations.

## Features
- Provides a user chat window supporting LLM API address and authorization key configuration
- Supports user-specified SQLite database files
- Automatically analyzes database structure and extracts metadata:
  - Table and field information
  - Field enumeration value mapping (e.g., gender: male/female, male/female, etc.)
  - Primary keys, foreign keys, and index information
- Dynamically generates RESTful APIs for database operations
- Intelligent session management:
  - Supports context memory for understanding follow-up queries
  - Automatic session cleanup after timeout (30 minutes)
  - Result summary generation
- Converts user natural language queries into API requests
- Executes API requests and returns results
- Supports multi-step complex queries

## Tech Stack
- **Runtime**: Bun
- **Web Framework**: Hono
- **Database**: SQLite
- **ORM**: TypeORM
- **LLM Integration**: OpenAI API and compatible interfaces

## Quick Start

### Prerequisites
- Install [Bun](https://bun.sh/) runtime
- Prepare a SQLite database file
- Obtain an OpenAI API key or other compatible LLM API key

### Installation
1. Clone the repository
```bash
git clone https://github.com/loocor/db2llm.git
cd db2llm
```

2. Install dependencies
```bash
bun install
```

3. Configure LLM
Modify the `config/config.yaml` file:
```yaml
server:
  port: 3000
  host: "localhost"

database:
  tempDir: "db2llm"
  defaultName: "db2llm.sqlite"
  connection:
    synchronize: false
    logging: ["error", "warn"]

llm:
  provider: "deepseek"
  openai:
    model: "deepseek-chat"
    temperature: 0.3
    defaultApiUrl: "https://api.deepseek.com/v1"
    apiKey: "sk-4c907ed3eed5468db793b6f431e9a28c"

ui:
  title: "DB2LLM - Database Chat Assistant"
  welcomeMessage: "Welcome to DB2LLM Database Chat Assistant! Please connect to the database and configure the LLM API first."
  readyMessage: "I'm ready, let's chat!"
```

Supported LLM providers:
- DeepSeek API (default)
- OpenAI API
- Azure OpenAI
- Claude API
- Other OpenAI API compatible services

### Run
```bash
bun run dev
```

The application will start at http://localhost:3000.

### Usage
1. Open your browser and visit http://localhost:3000
2. Upload a SQLite database file
3. Enter the LLM API key (and optional API address)
4. Click the "Connect" button
5. After successful connection, enter natural language queries in the dialog box
6. The system will automatically process the query and return results

## Example Queries
- "Show all user information"
- "Find all female users"
- "Count the number of male users"
- "Add a new user named Li Si, male, age 30"
- "Update the phone number of user with ID 5 to 13812345678"
- "Delete user with ID 10"
- "Try again" (context-based follow-up query)

## Database Support
### Field Types
- Basic types: INTEGER, TEXT, NUMBER, etc.
- Supports custom enumeration value mapping, such as:
  - Gender: ['female', 'female', 'f', '2', '0'] -> Female
  - Status: ['active', '1', 'enabled'] -> Enabled

### Metadata
- Table structure information
- Field attributes (primary key, not null, etc.)
- Field enumeration value mapping
- Foreign key relationships
- Index information

## Notes
- This project is a proof-of-concept prototype and is not recommended for production use
- User authentication and authorization mechanisms are not implemented
- Performance with large databases is not optimized
- API keys are entered directly in the frontend, posing security risks
- Session data is stored in memory and will be lost after server restart

## License
MIT

## Contribution
Welcome to submit Issues and Pull Requests!