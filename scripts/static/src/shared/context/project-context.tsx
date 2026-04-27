import { createContext, useContext, type PropsWithChildren } from 'react';

type ProjectContextValue = {
  projectId: string;
};

const ProjectContext = createContext<ProjectContextValue>({
  projectId: 'local-handwriting-project',
});

export const useProjectContext = () => useContext(ProjectContext);

export const ProjectProvider = ({
  children,
  value,
}: PropsWithChildren<{ value?: Partial<ProjectContextValue> }>) => (
  <ProjectContext.Provider value={{ projectId: 'local-handwriting-project', ...value }}>
    {children}
  </ProjectContext.Provider>
);
