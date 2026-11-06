from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.hotel_schema import HotelDetailResponse


class FavoritoCreate(BaseModel):
    id_hotel: int


class FavoritoResponse(BaseModel):
    id_favorito: int
    id_hotel: int
    fecha_creacion: datetime | None = None
    hotel: HotelDetailResponse | None = None

    model_config = ConfigDict(from_attributes=True)
