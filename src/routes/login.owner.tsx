import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Key, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login/owner")({
    component: OwnerLogin,
});

function OwnerLogin() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) {
                toast.error("Please enter your email");
                return;
        }
        setLoading(true);
        try {
                const { error } = await supabase.auth.signInWithOtp({
                          email: email.trim(),
                          options: { emailRedirectTo: window.location.origin + "/owner" },
                });
                if (error) throw error;
                setSent(true);
                toast.success("Magic link sent! Check your email.");
        } catch (err: any) {
                toast.error(err.message || "Failed to send login link");
        } finally {
                setLoading(false);
        }
  };

  return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
              <div className="w-full max-w-md">
                      <button
                                  onClick={() => navigate({ to: "/" })}
                                  className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
                                >
                                <ArrowLeft className="w-4 h-4" />
                                Back
                      </button>button>
              
                      <div className="flex flex-col items-center mb-8">
                                <div className="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center mb-4">
                                            <Key className="w-8 h-8 text-white" />
                                </div>div>
                                <h1 className="text-2xl font-bold text-white">Owner Login</h1>h1>
                                <p className="text-gray-400 mt-1">We'll send a magic link to your email</p>p>
                      </div>div>
              
                {sent ? (
                    <div className="text-center bg-white/10 rounded-xl p-8">
                                <Mail className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
                                <h2 className="text-white text-xl font-semibold mb-2">Check your email!</h2>h2>
                                <p className="text-gray-400">We sent a magic login link to</p>p>
                                <p className="text-yellow-400 font-medium mt-1">{email}</p>p>
                                <p className="text-gray-500 text-sm mt-4">Click the link in the email to log in. It expires in 1 hour.</p>p>
                                <button
                                                onClick={() => setSent(false)}
                                                className="text-gray-400 hover:text-white text-sm mt-6 underline"
                                              >
                                              Use a different email
                                </button>button>
                    </div>div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                                <div className="space-y-2">
                                              <Label className="text-gray-300">Email Address</Label>Label>
                                              <Input
                                                                type="email"
                                                                placeholder="owner@example.com"
                                                                value={email}
                                                                onChange={(e) => setEmail(e.target.value)}
                                                                className="bg-white/10 border-white/20 text-white placeholder:text-gray-500 h-12"
                                                                disabled={loading}
                                                              />
                                </div>div>
                                <Button
                                                type="submit"
                                                disabled={loading}
                                                className="w-full h-12 bg-yellow-500 hover:bg-yellow-600 text-white font-semibold text-base"
                                              >
                                  {loading ? "Sending..." : "Send Magic Link →"}
                                </Button>Button>
                    </form>form>
                      )}
              </div>div>
        </div>div>
      );
}</div>
