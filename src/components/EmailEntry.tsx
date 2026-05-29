import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, User } from "lucide-react";
import { toast } from "sonner";

export function EmailEntry() {
      const navigate = useNavigate();
      const [name, setName] = useState("");
      const [phone, setPhone] = useState("");
      const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
          e.preventDefault();
          if (!name.trim() || !phone.trim()) {
                    toast.error("Please enter your name and phone number");
                    return;
          }
          if (phone.length !== 10 || !/^[0-9]+$/.test(phone)) {
                    toast.error("Please enter a valid 10-digit phone number");
                    return;
          }
          setLoading(true);
          localStorage.setItem("student_name", name.trim());
          localStorage.setItem("student_phone", phone);
          toast.success(`Welcome, ${name.trim()}!`);
          navigate({ to: "/student" });
          setLoading(false);
  };

  return (
          <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-4">
                <div className="w-full max-w-md">
                        <button
                                      onClick={() => navigate({ to: "/" })}
                                      className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
                                    >
                                  <ArrowLeft className="w-4 h-4" /> Back
                        </button>button>
                        <div className="flex flex-col items-center mb-8">
                                  <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center mb-4">
                                              <User className="w-8 h-8 text-white" />
                                  </div>div>
                                  <h1 className="text-2xl font-bold text-white">Student Login</h1>h1>
                                  <p className="text-gray-400 mt-1">Enter your details to book a seat</p>p>
                        </div>div>
                        <form onSubmit={handleSubmit} className="space-y-5">
                                  <div className="space-y-2">
                                              <label className="text-gray-300 text-sm font-medium">Full Name</label>label>
                                              <input
                                                                type="text"
                                                                placeholder="Enter your full name"
                                                                value={name}
                                                                onChange={(e) => setName(e.target.value)}
                                                                className="w-full bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-500 h-12 px-3"
                                                                disabled={loading}
                                                              />
                                  </div>div>
                                  <div className="space-y-2">
                                              <label className="text-gray-300 text-sm font-medium">Phone Number</label>label>
                                              <div className="flex gap-2">
                                                            <div className="flex items-center bg-white/10 border border-white/20 rounded-md px-3 text-gray-400 text-sm">
                                                                            +91
                                                            </div>div>
                                                            <input
                                                                                type="tel"
                                                                                placeholder="10-digit mobile number"
                                                                                value={phone}
                                                                                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                                                                                className="flex-1 bg-white/10 border border-white/20 rounded-md text-white placeholder-gray-500 h-12 px-3"
                                                                                disabled={loading}
                                                                                maxLength={10}
                                                                              />
                                              </div>div>
                                  </div>div>
                                  <button
                                                  type="submit"
                                                  disabled={loading}
                                                  className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-base rounded-md mt-2"
                                                >
                                      {loading ? "Please wait..." : "Continue to Book Seat \u2192"}
                                  </button>button>
                        </form>form>
                </div>div>
          </div>div>
        );
}</div>
