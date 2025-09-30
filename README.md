# Pentaho Workflow Visualizer

A modern web application for reading and visualizing Pentaho KTR (transformation), KTJ (job), and KJB (job) files. Upload your Pentaho files and see them rendered as interactive flowcharts with detailed node properties.

## Features

- 📁 **File & Folder Upload**: Drag & drop single files or entire folders containing KTR, KTJ, and KJB files
- 📊 **Sankey-like Dependency Graph**: Hierarchical flow visualization showing dependencies from left to right
- 🎨 **Hop-Based Flow Visualization**: Individual workflows use left-to-right layouts determined by hop connections between steps
- 🔍 **Node Details**: Click on any node to see detailed properties and configuration
- 👁 **Drill-Down Navigation**: Navigate from folder view to individual file workflows
- 🎯 **Smart Parsing**: Robust extraction of steps, jobs, hops (connections), database connections, and file references - handles all Pentaho file structure variations with automatic fallback to inferred connections
- 🤖 **AI-Powered Summaries**: Generate intelligent summaries of step functionality using LLM analysis - explains what each step does, its inputs/outputs, and key configuration in plain English
- 🔗 **Dependency Analysis**: Identifies how transformations and jobs reference each other
- 🌐 **Modern UI**: Clean, responsive interface built with React and Tailwind CSS
- ⚡ **Real-time**: Fast parsing and visualization with TypeScript throughout

## Tech Stack

### Frontend
- **React** + **TypeScript** + **Vite** - Modern development stack
- **React Flow** - Interactive graph visualization
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Beautiful icons
- **Axios** - HTTP client

### Backend
- **Node.js** + **Express** + **TypeScript** - Server framework
- **Multer** - File upload handling
- **xml2js** - XML parsing for KTR files
- **Native JSON** - Parsing for KTJ files

## Quick Start

### Prerequisites
- Node.js 16+ and npm
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd pentaho-visualizer
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install server dependencies
   cd server && npm install && cd ..
   
   # Install client dependencies
   cd client && npm install && cd ..
   ```

3. **Start the development servers**
   ```bash
   # From the root directory - starts both frontend and backend
   npm run dev
   ```

   This will start:
   - Backend server at `http://localhost:3001`
   - Frontend development server at `http://localhost:3000`

4. **Configure Environment Variables**
   Set up your environment configuration:
   ```bash
   # Copy environment templates
   cp .env.example .env
   cd server && cp .env.example .env && cd ..
   cd client && cp .env.example .env && cd ..
   
   # Edit server/.env and add your AI configuration:
   # For Databricks (Recommended):
   # DATABRICKS_TOKEN=your_databricks_personal_access_token_here
   # 
   # For OpenAI (Alternative):
   # OPENAI_API_KEY=your_openai_api_key_here
   ```

5. **Open your browser**
   Navigate to `http://localhost:3000` to use the application.

### Alternative: Run servers separately

```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend  
cd client
npm run dev
```

## Usage

### Single File Mode

1. **Upload a File**: Switch to "Single File" mode and drag and drop a `.ktr`, `.ktj`, or `.kjb` file onto the upload area, or click to browse and select a file.

2. **View the Workflow**: Once parsed, you'll see a hierarchical flow diagram showing:
   - **Left-to-Right Flow**: Steps arranged intelligently based on hop dependencies using Dagre layout
   - **Smart Connectors**: Blue input connectors on the left, green output connectors on the right of each step
   - **Nodes**: Steps (purple), Jobs (blue), Start (green), End (red) with proper left/right connection points
   - **Enhanced Hops**: Color-coded hop arrows (data=green, conditional=blue, error=red, disabled=dashed)
   - **Hop-Based Layout**: Flow direction determined by enabled hops with optimized spacing
   - **Flow Analysis**: Real-time display of steps, hop counts, and hop types
   - **Interactive Legend**: Shows hop types and workflow statistics

3. **Explore Node Details**: Click on any node to open a properties panel showing:
   - **AI Summary** (if enabled): Plain English explanation of what the step does, its purpose, inputs, outputs, and key settings
   - Basic information (name, type, description)
   - Key properties (SQL queries, file paths, connections)
   - Additional configuration details
   - Position coordinates

### Folder Mode (NEW!)

1. **Upload a Folder**: Switch to "Folder" mode and select a folder containing multiple KTR, KTJ, and KJB files.

2. **View Dependencies**: See a Sankey-like hierarchical dependency graph showing:
   - **File Nodes**: Each file represented as a compact node (transformations in purple, jobs in blue)
   - **Flow Direction**: Left-to-right layout showing dependency flow from entry points to end points
   - **Weighted Edges**: Connection thickness indicates dependency strength
   - **Reference Types**: Color-coded arrows ("executes"=red, "calls"=blue, "includes"=green)
   - **Flow Analysis**: Real-time display of entry points, processors, and end points
   - **Interactive Legend**: Shows connection types and graph statistics

3. **Explore Files**: 
   - **Click on file nodes** to see detailed file properties and statistics
   - **Click the eye icon** or "View Internal Workflow" to drill down into individual files
   - **Navigate back** using breadcrumbs or the "Back to Folder" button

4. **Navigate the Graph**: Use the built-in controls to:
   - Zoom in/out
   - Pan around the workflow
   - Fit the entire graph to view
   - Reset the viewport

## AI-Powered Features 🤖

The application includes optional AI-powered features that can analyze your Pentaho steps and generate human-readable summaries.

### **AI Step Summaries**
- **Intelligent Analysis**: AI analyzes step configuration and generates plain English explanations
- **What it does**: Clear summary of the step's function
- **Purpose**: Main objective of the step
- **Inputs/Outputs**: What data goes in and comes out
- **Key Settings**: Important configuration parameters that affect behavior

### **How to Enable AI Features**

1. **Get an AI API Key**:
   - **Databricks** (Recommended): Get a [Personal Access Token](https://docs.databricks.com/dev-tools/auth.html#personal-access-tokens)
   - **OpenAI** (Alternative): Get an [API Key](https://platform.openai.com/api-keys)

2. **Configure Environment**:
   ```bash
   cd server
   cp .env.example .env
   # Edit .env and add your configuration
   ```

3. **Add your credentials to server/.env**:
   ```bash
   # For Databricks:
   DATABRICKS_TOKEN=your_databricks_token_here
   
   # OR for OpenAI:
   # OPENAI_API_KEY=your_openai_key_here
   # AI_PROVIDER=openai
   ```

4. **Restart the server** - you'll see: `🤖 AI summaries: Available`
5. **Generate Summaries**: Click any step → AI Summary section → "Generate Summary"

### **AI Features Without API Key**
- **Rule-based Summaries**: Basic summaries generated using step type rules
- **No External Calls**: Works completely offline with reduced functionality
- **Still Useful**: Provides basic step information and categorization

### **Visual Indicators**
- **✨ Yellow badge** on nodes that have AI summaries
- **Generate button** in properties panel for steps without summaries
- **Status indicator** shows if AI features are available

## File Format Support

### KTR Files (Pentaho Transformations)
- XML-based transformation files
- Extracts steps, hops, database connections, and parameters
- Supports all standard Pentaho transformation step types

### KTJ Files (Pentaho Jobs)  
- JSON-based job files
- Extracts job entries, hops, connections, and metadata
- Handles conditional and unconditional job flows

### KJB Files (Kettle Jobs)
- XML-based job files (legacy Kettle format)
- Uses `<job>` root element (different from KTR's `<transformation>`)
- Extracts job entries, hops, connections, and job-specific metadata
- Supports conditional and unconditional job flows

## Project Structure

```
pentaho-visualizer/
├── README.md
├── package.json                 # Root package with dev scripts
├── server/                      # Backend (Node.js + Express)
│   ├── src/
│   │   ├── index.ts            # Main server file
│   │   ├── parsers.ts          # KTR/KTJ parsing logic
│   │   └── types.ts            # TypeScript type definitions
│   ├── package.json
│   └── tsconfig.json
└── client/                      # Frontend (React + TypeScript)
    ├── src/
    │   ├── components/
    │   │   ├── FileUpload.tsx       # File upload component
    │   │   ├── WorkflowVisualizer.tsx # Main graph component
    │   │   ├── PentahoNode.tsx      # Custom node component
    │   │   └── NodePropertiesPanel.tsx # Node details panel
    │   ├── App.tsx             # Main app component
    │   ├── main.tsx            # React entry point
    │   ├── types.ts            # Shared type definitions
    │   └── index.css           # Global styles
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    └── tsconfig.json
```

## API Endpoints

### POST `/api/parse`
Upload and parse a single KTR or KTJ file.

**Request**: Multipart form data with file
**Response**: 
```json
{
  "success": true,
  "fileName": "example.ktr",
  "fileType": ".ktr",
  "workflow": {
    "name": "My Transformation",
    "type": "transformation",
    "nodes": [...],
    "connections": [...],
    "metadata": {...}
  }
}
```

### POST `/api/parse-folder` (NEW!)
Upload and parse multiple KTR and KTJ files from a folder.

**Request**: Multipart form data with multiple files + folderName
**Response**: 
```json
{
  "success": true,
  "folderName": "My ETL Project",
  "folderWorkflow": {
    "folderName": "My ETL Project",
    "files": [...],
    "dependencies": [...],
    "metadata": {
      "totalFiles": 5,
      "transformations": 3,
      "jobs": 2,
      "dependencies": 4,
      "parsed": "2025-09-23T17:00:00.000Z"
    }
  }
}
```

### GET `/api/health`
Health check endpoint.

## Development

### Adding New Step Types
To support additional Pentaho step types:

1. Update the icon mapping in `client/src/components/PentahoNode.tsx`
2. Add any special parsing logic in `server/src/parsers.ts`
3. Update type definitions if needed

### Customizing the Graph
The visualization uses React Flow. Key customization points:

- **Node appearance**: `PentahoNode.tsx` 
- **Edge styling**: `WorkflowVisualizer.tsx`
- **Layout algorithm**: Currently uses React Flow's default positioning
- **Interactions**: Node clicks, panning, zooming all configurable

### Building for Production

```bash
# Build the client
cd client && npm run build

# Build the server  
cd server && npm run build

# Start production server
cd server && npm start
```

## Troubleshooting

**File upload fails**: Check that files have `.ktr` or `.ktj` extensions and are valid Pentaho files.

**Graph doesn't display**: Ensure React Flow styles are loaded correctly in `index.css`.

**Parsing errors**: Check the browser console and server logs for detailed error messages.

**CORS issues**: The Vite dev server proxies API calls to avoid CORS issues in development.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Future Enhancements

- Export graphs as images or PDFs
- Advanced graph layouts (hierarchical, circular)
- Search and filter functionality
- Support for additional Pentaho file formats
- Real-time collaboration features
- Performance optimization for large workflows
