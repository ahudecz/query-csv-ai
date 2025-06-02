
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sidebar } from "@/components/Sidebar";
import { UploadData } from "@/components/UploadData";
import { DataPreview } from "@/components/DataPreview";
import { AskQuestions } from "@/components/AskQuestions";
import { ViewResults } from "@/components/ViewResults";

const Index = () => {
  const [activeSection, setActiveSection] = useState("upload");
  const [uploadedData, setUploadedData] = useState(null);

  const renderActiveSection = () => {
    switch (activeSection) {
      case "upload":
        return <UploadData onDataUploaded={setUploadedData} />;
      case "questions":
        return <AskQuestions uploadedData={uploadedData} />;
      case "results":
        return <ViewResults uploadedData={uploadedData} />;
      default:
        return <UploadData onDataUploaded={setUploadedData} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Data Analytics Dashboard</h1>
              <p className="text-gray-600">Upload your CSV data and get AI-powered insights</p>
            </header>

            {uploadedData && (
              <div className="mb-8">
                <DataPreview data={uploadedData} />
              </div>
            )}

            <div className="bg-white rounded-lg shadow-lg">
              {renderActiveSection()}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default Index;
