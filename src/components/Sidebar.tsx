
import { cn } from "@/lib/utils";
import { Upload, MessageSquare, BarChart } from "lucide-react";

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

export const Sidebar = ({ activeSection, onSectionChange }: SidebarProps) => {
  const menuItems = [
    {
      id: "upload",
      label: "Upload Data",
      icon: Upload,
      description: "Upload your CSV files"
    },
    {
      id: "questions",
      label: "Ask Questions",
      icon: MessageSquare,
      description: "AI-powered data analysis"
    },
    {
      id: "results",
      label: "View Results",
      icon: BarChart,
      description: "Charts and visualizations"
    }
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-8">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <BarChart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">DataSight</h2>
            <p className="text-sm text-gray-500">AI Analytics</p>
          </div>
        </div>

        <nav className="space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-colors",
                  activeSection === item.id
                    ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <Icon className="w-5 h-5" />
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-sm text-gray-500">{item.description}</div>
                </div>
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
