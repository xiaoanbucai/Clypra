import React, { useState, useEffect } from "react";
import { Film, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { EmptyState } from "../ui/EmptyState";
import { useProjectStore } from "../../store/projectStore";
import type { AspectRatio, Project } from "../../types";

interface LaunchScreenProps {
  onProjectCreate: (name: string, aspectRatio: AspectRatio, frameRate: 24 | 30 | 60) => void;
  onProjectOpen: (project: Project) => void;
}

export const LaunchScreen: React.FC<LaunchScreenProps> = ({ onProjectCreate, onProjectOpen }) => {
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>("16:9");
  const [selectedFps, setSelectedFps] = useState<24 | 30 | 60>(30);
  const { recentProjects, setRecentProjects } = useProjectStore();

  useEffect(() => {
    const loadRecentProjects = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const projectsJson: string[] = await invoke("get_recent_projects");
        const projects = projectsJson.map((json) => JSON.parse(json));
        setRecentProjects(projects);
      } catch (error) {
        console.error("Failed to load recent projects:", error);
      }
    };
    loadRecentProjects();
  }, [setRecentProjects]);

  const handleCreateProject = () => {
    if (projectName.trim()) {
      onProjectCreate(projectName, selectedRatio, selectedFps);
      setProjectName("");
      setSelectedRatio("16:9");
      setSelectedFps(30);
      setShowNewProjectModal(false);
    }
  };

  const aspectRatios: { ratio: AspectRatio; label: string; useCase: string }[] = [
    { ratio: "16:9", label: "16:9", useCase: "YouTube" },
    { ratio: "9:16", label: "9:16", useCase: "Reels" },
    { ratio: "1:1", label: "1:1", useCase: "Square" },
    { ratio: "4:3", label: "4:3", useCase: "Standard" },
    { ratio: "21:9", label: "21:9", useCase: "Ultrawide" },
  ];

  // Calculate dimensions that maintain aspect ratio with proper visual balance
  const getAspectRatioDimensions = (ratio: AspectRatio) => {
    const baseSize = 56;
    const aspectMap: Record<AspectRatio, { width: number; height: number }> = {
      "16:9": { width: baseSize, height: baseSize * (9 / 16) },
      "9:16": { width: baseSize * (9 / 16), height: baseSize },
      "1:1": { width: baseSize * 0.7, height: baseSize * 0.7 },
      "4:3": { width: baseSize * 0.85, height: baseSize * (3 / 4) * 0.85 },
      "21:9": { width: baseSize * 1.1, height: baseSize * (9 / 21) * 1.1 },
    };
    return aspectMap[ratio];
  };

  return (
    <div className="w-full h-full bg-bg flex flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <Film className="w-12 h-12 text-accent" />
          <h1 className="text-5xl font-bold text-text-primary">Clypra</h1>
        </div>
        <p className="text-xl text-text-muted">Professional Video Editor</p>
      </div>

      <div className="flex gap-4">
        <Button variant="default" size="lg" onClick={() => setShowNewProjectModal(true)}>
          New Project
        </Button>
        <Button variant="secondary" size="lg">
          Open Project
        </Button>
      </div>

      <div className="w-full max-w-4xl">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Recent Projects</h2>
        {recentProjects.length === 0 ? (
          <EmptyState icon={Film} title="No recent projects" description="Create a new project to get started" action={{ label: "New Project", onClick: () => setShowNewProjectModal(true) }} />
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {recentProjects.slice(0, 6).map((project) => (
              <button key={project.id} onClick={() => onProjectOpen(project)} className="bg-surface rounded-lg border border-border p-4 hover:brightness-110 transition-all hover:border-accent">
                <div className="bg-surface-raised rounded w-full h-24 mb-3 flex items-center justify-center">
                  <Film className="w-8 h-8 text-text-muted" />
                </div>
                <h3 className="font-semibold text-text-primary truncate">{project.name}</h3>
                <p className="text-xs text-text-muted mt-1">{new Date(project.createdAt).toLocaleDateString()}</p>
                <p className="text-xs text-accent mt-1">{project.aspectRatio}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showNewProjectModal}
        onClose={() => setShowNewProjectModal(false)}
        title="Create New Project"
        footer={
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" onClick={() => setShowNewProjectModal(false)}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleCreateProject} disabled={!projectName.trim()}>
              Create Project
            </Button>
          </div>
        }
      >
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Project Name</label>
            <input autoFocus type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="Untitled Project" className="w-full px-3 py-2 bg-surface-raised border border-border rounded text-text-primary placeholder-text-muted focus:outline-none focus:border-accent" onKeyPress={(e) => e.key === "Enter" && handleCreateProject()} />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-3">Aspect Ratio</label>
            <div className="flex gap-3 justify-center flex-wrap">
              {aspectRatios.map(({ ratio, label, useCase }) => {
                const { width, height } = getAspectRatioDimensions(ratio);
                return (
                  <button key={ratio} onClick={() => setSelectedRatio(ratio)} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-2.5 transition-all hover:scale-105 min-w-[90px] ${selectedRatio === ratio ? "border-accent bg-surface-raised shadow-lg" : "border-border hover:border-accent/50"}`}>
                    <div className="bg-accent rounded-sm shadow-sm" style={{ width: `${width}px`, height: `${height}px` }} />
                    <div className="text-center">
                      <div className="text-xs font-bold text-text-primary">{label}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{useCase}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">Frame Rate</label>
            <div className="flex gap-2">
              {[24, 30, 60].map((fps) => (
                <button key={fps} onClick={() => setSelectedFps(fps as any)} className={`flex-1 py-2 px-3 rounded border-2 font-medium transition-colors ${selectedFps === fps ? "border-accent bg-accent text-white" : "border-border text-text-primary hover:border-surface-raised"}`}>
                  {fps}fps
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
