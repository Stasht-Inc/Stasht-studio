import { Upload } from "lucide-react";
import { Button } from "../ui/button";
import { useState, useRef, forwardRef, useImperativeHandle } from "react";

interface MainUploadAreaProps {
  onFilesUpload: (files: File[]) => void;
}

export interface MainUploadAreaRef {
  triggerUpload: () => void;
}

export const MainUploadArea = forwardRef<MainUploadAreaRef, MainUploadAreaProps>(
  ({ onFilesUpload }, ref) => {
    const [isDragOver, setIsDragOver] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Expose the triggerUpload method to parent components
    useImperativeHandle(ref, () => ({
      triggerUpload: () => {
        console.log('🎯 MainUploadArea: triggerUpload called');
        if (fileInputRef.current) {
          console.log('🎯 MainUploadArea: Clicking file input');
          fileInputRef.current.click();
        } else {
          console.error('🎯 MainUploadArea: File input ref is null');
        }
      }
    }));

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter(file =>
        file.type.startsWith('image/') || file.type.startsWith('video/')
      );
      if (files.length > 0) {
        onFilesUpload(files);
      }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);

      if (files.length > 0) {
        onFilesUpload(files);
      }
    };

    return (
    <div 
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 ${
        isDragOver 
          ? 'border-[#6C60FF] bg-[#6C60FF]/5' 
          : 'border-gray-300 hover:border-[#6C60FF]/50 hover:bg-[#6C60FF]/5'
      }`}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
    >
      <Upload className={`w-16 h-16 mx-auto mb-4 transition-colors ${
        isDragOver ? 'text-[#6C60FF]' : 'text-gray-400'
      }`} />
      <h3 className="text-lg font-medium text-gray-900 mb-2">
        Upload your media files
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Drag and drop your photos and videos here, or click to browse your files. 
        Supported formats: JPG, PNG
      </p>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        onChange={handleFileSelect}
        className="hidden"
        id="main-file-upload"
        style={{ display: 'none' }}
      />
      <label htmlFor="main-file-upload" className="cursor-pointer">
        <Button
          size="lg"
          className="bg-[#6C60FF] text-white hover:bg-[#5951E6] cursor-pointer"
          type="button"
          onClick={(e) => {
            e.preventDefault();
            if (fileInputRef.current) {
              fileInputRef.current.click();
            }
          }}
        >
          <Upload className="w-5 h-5 mr-2 text-white" />
          Choose Files
        </Button>
      </label>
    </div>
    );
  }
);