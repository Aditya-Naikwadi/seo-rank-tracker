import { Navigate, Outlet } from "react-router-dom";
import { useUser } from "../context/UserContext";

interface ProtectedRouteProps {
    adminOnly?: boolean;
}

export default function ProtectedRoute({ adminOnly = false }: ProtectedRouteProps) {
    const { user } = useUser();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (adminOnly && user.role !== "admin") {
        return <Navigate to="/dashboard" replace />;
    }

    return <Outlet />;
}

