import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { FolderPlus } from 'lucide-react';

interface InitProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  projectPath: string;
}

export const InitProjectDialog: React.FC<InitProjectDialogProps> = ({
  open,
  onOpenChange,
  onConfirm,
  projectPath,
}) => {
  const folderName = projectPath.split('/').pop() || 'this directory';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <FolderPlus className="w-6 h-6 text-primary" />
            </div>
            <DialogTitle className="text-xl">Create New Blink Agent</DialogTitle>
          </div>
          <DialogDescription className="text-base leading-relaxed pt-2">
            <span className="font-medium text-foreground">{folderName}</span> isn't a Blink project yet.
            <br />
            <br />
            Click <span className="font-medium text-foreground">OK</span> to start building a new Blink agent in this directory.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
