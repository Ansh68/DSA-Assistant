from qdrant_client import models

from app.core.qdrant import client
from app.core.config import QDRANT_COLLECTION


def main():

    print(
        f"Creating payload index for "
        f"'video_id' in '{QDRANT_COLLECTION}'..."
    )

    client.create_payload_index(
        collection_name=QDRANT_COLLECTION,
        field_name="video_id",
        field_schema=models.PayloadSchemaType.KEYWORD,
    )

    print("Payload index created successfully.")


if __name__ == "__main__":
    main()