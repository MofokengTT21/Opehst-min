declare module 'africastalking' {
  export default function africastalking(options: { apiKey: string; username: string }): {
    SMS: {
      send(options: { to: string[]; message: string; from?: string }): Promise<any>;
    };
  };
}
