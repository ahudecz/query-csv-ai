
import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { UploadDataEnhanced } from "@/components/UploadDataEnhanced";
import { DataPreview } from "@/components/DataPreview";
import { AskQuestionsEnhanced } from "@/components/AskQuestionsEnhanced";
import { ViewResults } from "@/components/ViewResults";

const Index = () => {
  const [activeSection, setActiveSection] = useState("upload");
  const [uploadedData, setUploadedData] = useState(null);

  const handleDataUploaded = (data: any) => {
    console.log('Data uploaded successfully:', data);
    setUploadedData(data);
    // Automatically switch to questions section after successful upload
    setActiveSection("questions");
  };

  const renderActiveSection = () => {
    switch (activeSection) {
      case "upload":
        return <UploadDataEnhanced onDataUploaded={handleDataUploaded} />;
      case "questions":
        return <AskQuestionsEnhanced uploadedData={uploadedData} />;
      case "results":
        return <ViewResults uploadedData={uploadedData} />;
      default:
        return <UploadDataEnhanced onDataUploaded={handleDataUploaded} />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="flex">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <header className="mb-8">
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Financial Analytics Dashboard</h1>
              <p className="text-gray-600">Upload your financial data and get AI-powered insights</p>
            </header>

            {uploadedData && activeSection !== "upload" && (
              <div className="mb-8">
                <DataPreview data={uploadedData.preview} />
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
