import { Upload, Checkbox, Banner } from "@douyinfe/semi-ui";
import { STATUS } from "../../../data/constants";
import { useTranslation } from "react-i18next";

export default function ImportDDL({
  importData,
  setImportData,
  error,
  setError,
}) {
  const { t } = useTranslation();

  return (
    <div>
      <textarea
        className="w-full h-48 p-2 border rounded"
        placeholder={t("paste_ddl_here")}
        value={importData.src}
        onChange={(e) => {
          setError({
            type: STATUS.NONE,
            message: "",
          });
          setImportData((prev) => ({ ...prev, src: e.target.value }));
        }}
      />
      <div className="mt-2">
        <Checkbox
          aria-label="overwrite checkbox"
          checked={importData.overwrite}
          defaultChecked
          onChange={(e) =>
            setImportData((prev) => ({
              ...prev,
              overwrite: e.target.checked,
            }))
          }
        >
          {t("overwrite_existing_diagram")}
        </Checkbox>
        <div className="mt-2">
          {error.type === STATUS.ERROR ? (
            <Banner
              type="danger"
              fullMode={false}
              description={<div>{error.message}</div>}
            />
          ) : error.type === STATUS.OK ? (
            <Banner
              type="info"
              fullMode={false}
              description={<div>{error.message}</div>}
            />
          ) : (
            error.type === STATUS.WARNING && (
              <Banner
                type="warning"
                fullMode={false}
                description={<div>{error.message}</div>}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}