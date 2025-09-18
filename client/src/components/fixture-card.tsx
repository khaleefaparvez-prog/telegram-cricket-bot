import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Clock, Zap } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Fixture = {
  id: string;
  sport: string;
  category: string;
  series: string;
  team1: string;
  team2: string;
  venue: string;
  date: string;
  time: string;
  status: string;
  tournament: string;
  externalId: string;
  createdAt: Date;
  updatedAt: Date;
};

export default function FixtureCard({ fixture }: { fixture: Fixture }) {
  const { toast } = useToast();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "live": return "bg-green-500";
      case "upcoming": return "bg-blue-500";
      case "completed": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const getSportColor = (sport: string) => {
    return sport === "cricket" ? "text-green-600" : "text-orange-600";
  };

  // Quick prediction mutation for cricket matches
  const quickPredictMutation = useMutation({
    mutationFn: async (fixture: Fixture) => {
      const predictionInput = {
        fixtureId: fixture.id,
        team1Id: `${fixture.sport}_${fixture.team1.toLowerCase().replace(/\s+/g, '_')}`,
        team2Id: `${fixture.sport}_${fixture.team2.toLowerCase().replace(/\s+/g, '_')}`,
        team1Name: fixture.team1,
        team2Name: fixture.team2,
        venue: fixture.venue,
        format: fixture.category === 't20' ? 't20' : fixture.category === 'international' ? 'odi' : 't20',
        matchDate: new Date(`${fixture.date} ${fixture.time}`),
        tournament: fixture.tournament,
        seriesContext: fixture.series
      };

      return apiRequest('POST', '/api/predict/fast', predictionInput);
    },
    onSuccess: (prediction: any) => {
      const team1Prob = Math.round(prediction.team1WinProb * 100);
      const team2Prob = Math.round(prediction.team2WinProb * 100);
      
      toast({
        title: "Quick Prediction Complete",
        description: `${fixture.team1}: ${team1Prob}% | ${fixture.team2}: ${team2Prob}% | Confidence: ${Math.round(prediction.confidence * 100)}%`,
        duration: 8000,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Prediction Failed",
        description: error.message || "Unable to generate quick prediction.",
        variant: "destructive",
      });
    },
  });

  const handleQuickPredict = () => {
    quickPredictMutation.mutate(fixture);
  };

  // Check if match is happening today
  const isMatchToday = () => {
    const today = new Date();
    const matchDate = new Date(fixture.date);
    
    return (
      today.getFullYear() === matchDate.getFullYear() &&
      today.getMonth() === matchDate.getMonth() &&
      today.getDate() === matchDate.getDate()
    );
  };

  return (
    <Card className="hover-elevate" data-testid={`fixture-card-${fixture.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Badge className={getSportColor(fixture.sport)} variant="secondary">
            {fixture.sport.toUpperCase()}
          </Badge>
          <Badge className={getStatusColor(fixture.status)} variant="secondary">
            {fixture.status}
          </Badge>
        </div>
        <CardTitle className="text-lg">{fixture.team1} vs {fixture.team2}</CardTitle>
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {fixture.venue}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {fixture.date} at {fixture.time}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Category:</span>
            <span className="font-medium">{fixture.category}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tournament:</span>
            <span className="font-medium">{fixture.tournament}</span>
          </div>
        </div>

        {/* Quick Predict Button - Only for cricket matches happening today */}
        {fixture.sport === "cricket" && isMatchToday() && fixture.status === "upcoming" && (
          <div className="mt-4">
            <Button
              onClick={handleQuickPredict}
              disabled={quickPredictMutation.isPending}
              className="w-full"
              data-testid={`button-quick-predict-${fixture.id}`}
            >
              <Zap className="h-4 w-4 mr-2" />
              {quickPredictMutation.isPending ? 'Predicting...' : 'Quick Predict'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}