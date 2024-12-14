import clientFetch from "@root/utils/client-fetch";
import { SITE_NAME_SHORT } from "@shared/config";
import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button, CancelButton } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "~/components/ui/card";
import { FormSuccessMessage } from "~/components/ui/form-message";
import Link from "~/components/ui/link";
import { LoadingSpinner } from "~/components/ui/spinner";
import { useTranslation } from "~/locales/provider";
import SessionsPageLink from "./help-link";

export default function ConfirmNewPasswordCard({ code }: { code: string }) {
    const { t } = useTranslation();
    const [isLoading, setIsLoading] = useState<{ value: boolean; action: "cancelling" | "confirming" | null }>({
        value: false,
        action: null,
    });
    const [successMessage, setSuccessMessage] = useState("");

    async function confirmToAddNewPassword() {
        try {
            if (isLoading.value === true) return;
            setIsLoading({ value: true, action: "confirming" });

            const response = await clientFetch("/api/user/password", {
                method: "PUT",
                body: JSON.stringify({ code: code }),
            });

            const result = await response.json();
            if (result?.success === true) {
                return setSuccessMessage(result?.message || t.common.success);
            }

            return toast.error(result?.message || t.common.error);
        } finally {
            setIsLoading({ value: false, action: null });
        }
    }

    async function cancelAddingNewPassword() {
        try {
            if (isLoading.value === true) return;
            setIsLoading({ value: true, action: "cancelling" });

            const response = await clientFetch("/api/user/confirmation-action", {
                method: "DELETE",
                body: JSON.stringify({ code: code }),
            });

            const result = await response.json();
            if (result?.success === true) {
                return setSuccessMessage(result?.message || t.common.success);
            }

            return toast.error(result?.message || t.common.error);
        } finally {
            setIsLoading({ value: false, action: null });
        }
    }

    return (
        <>
            <title>{`${t.auth.confirmNewPass} - ${SITE_NAME_SHORT}`}</title>
            <meta name="description" content={`Add new password to your ${SITE_NAME_SHORT} account`} />

            <Card className="max-w-md">
                <CardHeader>
                    <CardTitle>{t.auth.confirmNewPass}</CardTitle>
                </CardHeader>
                {successMessage ? (
                    <CardContent className="gap-2 items-center justify-center">
                        <FormSuccessMessage text={successMessage} />
                        <Link to="/" className="link_blue">
                            {t.common.home}
                        </Link>
                    </CardContent>
                ) : (
                    <>
                        <CardContent>
                            <CardDescription>{t.auth.confirmNewPassDesc}</CardDescription>
                            <div className="w-full flex items-center justify-end gap-panel-cards mt-3">
                                <CancelButton
                                    icon={isLoading.action === "cancelling" ? <LoadingSpinner size="xs" /> : null}
                                    onClick={cancelAddingNewPassword}
                                    disabled={isLoading.value}
                                />
                                <Button onClick={confirmToAddNewPassword} disabled={isLoading.value}>
                                    {isLoading.action === "confirming" ? (
                                        <LoadingSpinner size="xs" />
                                    ) : (
                                        <CheckIcon className="w-btn-icon h-btn-icon" />
                                    )}
                                    {t.form.confirm}
                                </Button>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <SessionsPageLink />
                        </CardFooter>
                    </>
                )}
            </Card>
        </>
    );
}
