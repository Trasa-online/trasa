import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { X, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserMentionInputProps {
  selectedUserIds: string[];
  onUserSelect: (userId: string) => void;
  onUserRemove: (userId: string) => void;
}

export default function UserMentionInput({ selectedUserIds, onUserSelect, onUserRemove }: UserMentionInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: profiles } = useQuery({
    queryKey: ["profiles", search],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .limit(10);

      if (search) {
        query = query.ilike("username", `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: selectedUsers } = useQuery({
    queryKey: ["selected-users", selectedUserIds],
    queryFn: async () => {
      if (selectedUserIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", selectedUserIds);
      if (error) throw error;
      return data || [];
    },
    enabled: selectedUserIds.length > 0,
  });

  return (
    <div className="space-y-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start text-left font-normal">
            <UserPlus className="h-4 w-4 mr-2" />
            Wybierz użytkownika
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 bg-background border-border z-50" align="start">
          <Command>
            <CommandInput 
              placeholder="Wyszukaj użytkownika..." 
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Nie znaleziono użytkownika</CommandEmpty>
              <CommandGroup>
                {profiles?.filter(p => !selectedUserIds.includes(p.id)).map((profile) => (
                  <CommandItem
                    key={profile.id}
                    onSelect={() => {
                      onUserSelect(profile.id);
                      setOpen(false);
                      setSearch("");
                    }}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      {profile.avatar_url ? (
                        <img 
                          src={profile.avatar_url} 
                          alt={profile.username}
                          className="h-6 w-6 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-xs">
                          {profile.username[0].toUpperCase()}
                        </div>
                      )}
                      <span>@{profile.username}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedUsers && selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedUsers.map((user) => (
            <Badge key={user.id} variant="secondary" className="flex items-center gap-1">
              {user.avatar_url ? (
                <img 
                  src={user.avatar_url} 
                  alt={user.username}
                  className="h-4 w-4 rounded-full object-cover"
                />
              ) : (
                <div className="h-4 w-4 rounded-full bg-muted flex items-center justify-center text-[10px]">
                  {user.username[0].toUpperCase()}
                </div>
              )}
              @{user.username}
              <button
                onClick={() => onUserRemove(user.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Oznacz znajomych, którzy byli z tobą
      </p>
    </div>
  );
}
