import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";

interface MissingDirectoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectName: string;
  projectPath: string;
  onRelocate: () => void;
  onRemove: () => void;
}

export const MissingDirectoryDialog: React.FC<MissingDirectoryDialogProps> = ({
  open,
  onOpenChange,
  projectName,
  projectPath,
  onRelocate,
  onRemove,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Project Directory Not Found</DialogTitle>
          <DialogDescription>
            The directory for <strong>{projectName}</strong> could not be found:
            <br />
            <code className="text-xs bg-muted px-2 py-1 rounded mt-2 block">
              {projectPath}
            </code>
            <br />
            The directory may have been moved, renamed, or deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onRemove}>
            Remove Project
          </Button>
          <Button onClick={onRelocate}>Choose New Location</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
