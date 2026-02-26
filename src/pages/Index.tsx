
import React, { useEffect } from "react";
import MenuSuperior from "@/components/MenuSuperior";
import PublicPlansSection from "@/components/sections/PublicPlansSection";
import Testimonials from "@/components/Testimonials";
import SimpleFooter from "@/components/SimpleFooter";
import ResponsiveHowItWorksSection from "@/components/sections/ResponsiveHowItWorksSection";
import HomeCarouselSection from "@/components/sections/HomeCarouselSection";
import PageLayout from "@/components/layout/PageLayout";
import SocialMediaButtons from "@/components/SocialMediaButtons";

const Index = () => {
  useEffect(() => {
    if (window.AOS) {
      window.AOS.init({
        duration: 600,
        once: true,
        offset: 50,
        delay: 0,
      });
    }
  }, []);

  return (
    <PageLayout
      variant="auth"
      backgroundOpacity="strong"
      showGradients={false}
      className="flex flex-col"
    >
      <MenuSuperior />

      <main className="w-full overflow-x-hidden">
        <HomeCarouselSection />
        <ResponsiveHowItWorksSection />
        <PublicPlansSection />
        <Testimonials />
      </main>

      <SimpleFooter />
      <SocialMediaButtons />
    </PageLayout>
  );
};

export default Index;
