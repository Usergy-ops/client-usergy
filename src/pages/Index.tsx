
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, Code, Palette, Zap } from "lucide-react";

const Index = () => {
  const features = [
    {
      icon: <Code className="h-6 w-6" />,
      title: "Clean Architecture",
      description: "Built with modern React, TypeScript, and Tailwind CSS"
    },
    {
      icon: <Palette className="h-6 w-6" />,
      title: "Beautiful Design",
      description: "Thoughtfully crafted with attention to every detail"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Fast Performance",
      description: "Optimized for speed and seamless user experience"
    },
    {
      icon: <Sparkles className="h-6 w-6" />,
      title: "Ready to Build",
      description: "Your creative canvas awaits your amazing ideas"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-16">
        <div className="text-center max-w-4xl mx-auto">
          {/* Floating Badge */}
          <div className="inline-flex items-center gap-2 bg-white border border-slate-200 rounded-full px-4 py-2 mb-8 shadow-sm animate-fade-in">
            <Sparkles className="h-4 w-4 text-primary animate-float" />
            <span className="text-sm font-medium text-slate-600">Your Blank Canvas Awaits</span>
          </div>

          {/* Main Heading */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 animate-fade-in">
            Start Building
            <br />
            <span className="gradient-text">Something Amazing</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in">
            A beautifully crafted blank project with modern design principles, 
            ready for your next breakthrough idea.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16 animate-fade-in">
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 text-lg font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            >
              Get Started
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              className="border-2 border-slate-200 hover:border-primary/20 px-8 py-3 text-lg font-medium rounded-xl hover:bg-slate-50 transition-all duration-200"
            >
              Learn More
            </Button>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border-0 shadow-sm bg-white/50 backdrop-blur-sm hover:shadow-md hover:bg-white/80 transition-all duration-300 hover:-translate-y-1 animate-fade-in"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <CardContent className="p-6 text-center">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg gradient-bg mb-4">
                    <div className="text-primary">
                      {feature.icon}
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2 text-slate-800">
                    {feature.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="container mx-auto px-4 pb-20">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 text-sm">
            <span>Ready when you are</span>
            <Sparkles className="h-4 w-4 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
