import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import { WorkBuddyApp } from "@/components/workbuddy-app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { i18n } from "@/lib/i18n";
import "./index.css";

i18n.start();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableColorScheme
      enableSystem
      storageKey="wb-theme-blue-v2"
    >
      <TooltipProvider delayDuration={180}>
        <WorkBuddyApp />
        <Toaster
          closeButton
          position="top-right"
          richColors
          gap={10}
          offset={{ top: 68, right: 18 }}
          mobileOffset={{ top: 64, left: 12, right: 12 }}
        />
      </TooltipProvider>
    </ThemeProvider>
  </StrictMode>,
);
