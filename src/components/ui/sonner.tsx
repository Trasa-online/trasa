import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = "light";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      closeButton={false}
      gap={8}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border/50 group-[.toaster]:shadow-xl group-[.toaster]:shadow-black/10 group-[.toaster]:text-sm group-[.toaster]:font-medium group-[.toaster]:py-4 group-[.toaster]:px-4 group-[.toaster]:rounded-2xl group-[.toaster]:mb-[calc(4rem+env(safe-area-inset-bottom,0px))]",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:font-normal",
          error: "group-[.toaster]:border-red-500/20 group-[.toaster]:bg-red-50 dark:group-[.toaster]:bg-red-950/30",
          icon: "group-[.toast]:w-5 group-[.toast]:h-5",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
