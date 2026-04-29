import { ProjectProvider } from "./app/ProjectContext";
import { AnalysisWorkspace } from "./features/workbench/AnalysisWorkspace";

function App() {
  return (
    <ProjectProvider>
      <AnalysisWorkspace />
    </ProjectProvider>
  );
}

export default App;
